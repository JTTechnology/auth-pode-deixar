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

describe('GET /auth/profile', () => {
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

  it('should get user profile successfully', async () => {
    const user = createTestUser();

    const tokens = await registerAndVerifyEmail(app, user);
    const accessToken = tokens.accessToken;

    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.completeName).toBe(user.complete_name);
    expect(response.body.user.role).toBe(user.role);
    expect(response.body.user).toHaveProperty('emailVerified', true);
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should fail get profile without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should fail get profile with invalid token', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should fail get profile with expired token', async () => {
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });
});