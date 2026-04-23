import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  cleanupDatabase,
  teardownTestApp,
  createTestUser,
  createProviderUser,
  createAdminUser,
  registerAndVerifyEmail,
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import cleanupDatabase from './test-setup';

describe('Admin Routes', () => {
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

  describe('GET /auth/admin', () => {
    it('should allow admin user to access admin route', async () => {
      const user = createProviderUser();

      const tokens = await registerAndVerifyEmail(app, user);
      const accessToken = tokens.accessToken;

      await prisma.user.update({
        where: { email: user.email },
        data: { role: 'ADMIN' },
      });

      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'This is admin only data',
      );
    });

    it('should fail admin access for client role', async () => {
      const user = createTestUser();

      const tokens = await registerAndVerifyEmail(app, user);
      const accessToken = tokens.accessToken;

      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Forbidden resource');
    });

    it('should fail admin access for provider role', async () => {
      const user = createProviderUser(); // ✅ corrigido

      const tokens = await registerAndVerifyEmail(app, user);
      const accessToken = tokens.accessToken;

      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Forbidden resource');
    });

    it('should fail admin access without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail admin access with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/admin')
        .set('Authorization', 'Bearerinvalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});