import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  createProviderUser,
  registerUser,
  verifyEmailViaApi,
  loginUser,
  registerAndLogin,
  promoteToAdmin,
  bearerAuth,
  teardownTestApp,
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';


describe('GET /auth/admin', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const setup = await setupTestApp();
    app = setup.app;
    prisma = setup.prisma;
  });

  afterAll(async () => {
    await teardownTestApp(app, prisma);
  });

  describe('Authorized access', () => {
    it('should allow a user with ADMIN role to access the route', async () => {
      const user = createProviderUser();
      await registerUser(app, user);
      await verifyEmailViaApi(app, user.email, prisma);

      await promoteToAdmin(prisma, user.email);

      const loginResponse = await loginUser(app, user.email, user.password);
      const accessToken = loginResponse.body.access_token;

      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set(bearerAuth(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('message', 'This is admin only data');
    });
  });

  describe('Forbidden access (wrong role)', () => {
    it('should deny access for CLIENT role with 403', async () => {
      const user = createTestUser(); // role: CLIENT
      const { accessToken } = await registerAndLogin(app, user, prisma);

      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set(bearerAuth(accessToken))
        .expect(403);

      expect(response.body.message).toContain('Forbidden resource');
    });

    it('should deny access for PROVIDER role with 403', async () => {
      const user = createProviderUser();
      const { accessToken } = await registerAndLogin(app, user, prisma);

      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set(bearerAuth(accessToken))
        .expect(403);

      expect(response.body.message).toContain('Forbidden resource');
    });
  });

  describe('Unauthenticated access', () => {
    it('should deny access without a token with 401', async () => {
      const response = await request(app.getHttpServer()).get('/auth/admin').expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should deny access with a malformed token with 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set('Authorization', 'Bearerinvalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});