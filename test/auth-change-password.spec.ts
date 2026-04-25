import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  registerAndLogin,
  loginUser,
  bearerAuth,
  teardownTestApp
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PUT /auth/change-password', () => {
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

  const NEW_PASSWORD = 'NewPassword123!';

  describe('Success cases', () => {
    it('should change password and allow login with the new password', async () => {
      const user = createTestUser();
      const { accessToken } = await registerAndLogin(app, user, prisma);

      const response = await request(app.getHttpServer())
        .put('/auth/change-password')
        .set(bearerAuth(accessToken))
        .send({ currentPassword: user.password, newPassword: NEW_PASSWORD })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password changed successfully');

      // Confirm the new password works
      await loginUser(app, user.email, NEW_PASSWORD);
    });
  });

  describe('Authentication failure cases', () => {
    it('should reject wrong current password with 400', async () => {
      const user = createTestUser();
      const { accessToken } = await registerAndLogin(app, user, prisma);

      const response = await request(app.getHttpServer())
        .put('/auth/change-password')
        .set(bearerAuth(accessToken))
        .send({ currentPassword: 'WrongPassword123!', newPassword: NEW_PASSWORD })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject request without authentication with 401', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .put('/auth/change-password')
        .send({ currentPassword: user.password, newPassword: NEW_PASSWORD })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject request with invalid token with 401', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .put('/auth/change-password')
        .set('Authorization', 'Bearerinvalid-token')
        .send({ currentPassword: user.password, newPassword: NEW_PASSWORD })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Validation cases', () => {
    it('should reject a weak new password with 400', async () => {
      const user = createTestUser();
      const { accessToken } = await registerAndLogin(app, user, prisma);

      const response = await request(app.getHttpServer())
        .put('/auth/change-password')
        .set(bearerAuth(accessToken))
        .send({ currentPassword: user.password, newPassword: 'weak' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject missing currentPassword with 400', async () => {
      const user = createTestUser();
      const { accessToken } = await registerAndLogin(app, user, prisma);

      await request(app.getHttpServer())
        .put('/auth/change-password')
        .set(bearerAuth(accessToken))
        .send({ newPassword: NEW_PASSWORD })
        .expect(400);
    });

    it('should reject missing newPassword with 400', async () => {
      const user = createTestUser();
      const { accessToken } = await registerAndLogin(app, user, prisma);

      await request(app.getHttpServer())
        .put('/auth/change-password')
        .set(bearerAuth(accessToken))
        .send({ currentPassword: user.password })
        .expect(400);
    });
  });
});