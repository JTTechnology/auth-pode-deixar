import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  registerAndLogin,
  teardownTestApp
} from './test-setup';
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
    await teardownTestApp(app, prisma);
  });

  it('should issue new token pair and rotate the refresh token', async () => {
    const user = createTestUser();
    const { refreshToken } = await registerAndLogin(app, user, prisma);

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(response.body).toMatchObject({ token_type: 'Bearer' });
    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
    // Rotation: the new refresh token must differ from the used one
    expect(response.body.refresh_token).not.toBe(refreshToken);
  });

  it('should reject a refresh token that has already been used (token rotation)', async () => {
    const user = createTestUser();
    const { refreshToken } = await registerAndLogin(app, user, prisma);

    // First use — valid
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    // Second use of the same token — must be rejected
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('should reject an invalid refresh token with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token' })
      .expect(401);
  });

  it('should reject a missing refresh token with 400', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').send({}).expect(400);
  });
});