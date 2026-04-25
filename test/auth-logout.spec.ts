import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  registerAndLogin,
  bearerAuth,
  teardownTestApp
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /auth/logout', () => {
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
  
  it('should logout successfully and invalidate the refresh token in the DB', async () => {
    const user = createTestUser();
    const { accessToken } = await registerAndLogin(app, user, prisma);

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set(bearerAuth(accessToken))
      .expect(200);

    expect(response.body).toHaveProperty('message', 'Logged out successfully');

    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    expect(dbUser?.refreshToken).toBeNull();
  });

  it('should reject logout without authentication with 401', async () => {
    const response = await request(app.getHttpServer()).post('/auth/logout').expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should reject logout with an invalid token with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });
});