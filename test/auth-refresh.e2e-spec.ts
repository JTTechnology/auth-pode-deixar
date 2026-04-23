import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser, registerAndLogin } from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /auth/refresh', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const setup = await setupTestApp();
    app = setup.app;
    prisma = setup.prisma;
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
    await teardownTestApp(app);
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  it('should refresh tokens successfully', async () => {
    const user = createTestUser();
    const tokens = await registerAndLogin(app, user);
    const refreshToken = tokens.refreshToken;

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(response.body).toMatchObject({ token_type: 'Bearer' });
    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
    expect(response.body.refresh_token).not.toBe(refreshToken);
  });

  it('should reject a refresh token that has already been used (token rotation)', async () => {
    const user = createTestUser();
    const tokens = await registerAndLogin(app, user);
    const refreshToken = tokens.refreshToken;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('should fail refresh with invalid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token' })
      .expect(401);
  });

  it('should fail refresh with missing token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(400);
  });
});