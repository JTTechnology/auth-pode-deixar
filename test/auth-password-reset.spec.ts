import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  registerUser,
  verifyEmailViaApi,
  loginUser,
  teardownTestApp
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
    await teardownTestApp(app, prisma);
  });

  /**
   * Registers + verifies a user, then triggers the forgot-password flow.
   * Returns the user object and the passwordResetToken stored in the DB.
   */
  async function setupResetFlow() {
    const user = createTestUser();
    await registerUser(app, user);
    await verifyEmailViaApi(app, user.email, prisma);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);

    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });

    if (!dbUser?.passwordResetToken)
      throw new Error('passwordResetToken missing after forgot-password request');

    return { user, resetToken: dbUser.passwordResetToken };
  }

  // ─── POST /auth/forgot-password ────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('should respond with a generic success message (no email enumeration)', async () => {
      const user = createTestUser();
      await registerUser(app, user);
      await verifyEmailViaApi(app, user.email, prisma);

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'If the email exists, a password reset link has been sent',
      );
    });

    it('should reject an invalid email format with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);
    });

    it('should reject a missing email with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({})
        .expect(400);
    });
  });

  // ─── POST /auth/reset-password ─────────────────────────────────────────────

  describe('POST /auth/reset-password', () => {
    it('should reset password and allow login with the new password', async () => {
      const { user, resetToken } = await setupResetFlow();
      const newPassword = 'NewPassword123!';

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword })
        .expect(200);

      // Confirm the old password no longer works implicitly by using the new one
      await loginUser(app, user.email, newPassword);
    });

    it('should reject an invalid token with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'NewPassword123!' })
        .expect(400);
    });

    it('should reject a weak new password with 400', async () => {
      const { resetToken } = await setupResetFlow();

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword: 'weak' })
        .expect(400);
    });

    it('should reject missing newPassword field with 400', async () => {
      const { resetToken } = await setupResetFlow();

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken })
        .expect(400);
    });

    it('should reject an expired reset token with 400', async () => {
      const { user, resetToken } = await setupResetFlow();

      await prisma.user.update({
        where: { email: user.email },
        data: { passwordResetExpires: new Date(Date.now() - 1_000) },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.message).toContain('Invalid or expired reset token');
    });
  });
});