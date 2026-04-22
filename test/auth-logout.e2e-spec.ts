import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  cleanupDatabase,
  createTestUser,
  registerAndVerifyEmail
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
    await cleanupDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  it('should logout successfully', async () => {
    const user = createTestUser();

    const tokens = await registerAndVerifyEmail(app, user);
    const accessToken = tokens.accessToken;

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('message', 'Logged out successfully');

    // Verify refresh token is invalidated
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    expect(dbUser?.refreshToken).toBeNull();
  });

  it('should fail logout without authentication', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should fail logout with invalid token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });
});