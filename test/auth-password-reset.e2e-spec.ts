import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  cleanupDatabase,
  createTestUser
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Password Reset Flow', () => {
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

  describe('POST /auth/forgot-password', () => {
    it('should send password reset email successfully', async () => {
      const user = createTestUser();

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          complete_name: user.complete_name,
          email: user.email,
          password: user.password,
          phone: user.phone,
          postal_code: user.postal_code,
          role: user.role
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'If the email exists, a password reset link has been sent'
      );
    });

    it('should fail with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);
    });

    it('should fail with missing email', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    async function setupResetFlow() {
      const user = createTestUser();

      console.log('Registering user:', user.email);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          complete_name: user.complete_name,
          email: user.email,
          password: user.password,
          phone: user.phone,
          postal_code: user.postal_code,
          role: user.role
        })
        .expect(201);

      await prisma.user.update({
        where: { email: user.email },
        data: { emailVerified: true },
      });

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      return {
        user,
        resetToken: dbUser?.passwordResetToken || '',
      };
    }

    it('should reset password successfully', async () => {
      const { user, resetToken } = await setupResetFlow();
      const newPassword = 'NewPassword123!';

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword,
        })
        .expect(200);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('access_token');
    });

    it('should fail reset with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
        })
        .expect(400);
    });

    it('should fail reset with weak password', async () => {
      const { resetToken } = await setupResetFlow();

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'weak',
        })
        .expect(400);
    });

    it('should fail reset with missing fields', async () => {
      const { resetToken } = await setupResetFlow();

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken })
        .expect(400);
    });

    it('should fail reset with expired token', async () => {
      const { user, resetToken } = await setupResetFlow();

      await prisma.user.update({
        where: { email: user.email },
        data: {
          passwordResetExpires: new Date(Date.now() - 1000),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid or expired reset token');
    });
  });
});