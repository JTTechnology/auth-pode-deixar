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

// A token that is structurally valid JWT but has an already-elapsed exp claim.
const EXPIRED_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('GET /auth/profile', () => {
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

  it('should return safe user profile for a valid token', async () => {
    const user = createTestUser();
    const { accessToken } = await registerAndLogin(app, user, prisma);

    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set(bearerAuth(accessToken))
      .expect(200);

    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      email: user.email,
      complete_name: user.complete_name,
      role: user.role,
      email_verified: true,
    });
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer()).get('/auth/profile').expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should reject an invalid token with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should reject an expired token with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set(bearerAuth(EXPIRED_JWT))
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });
});