import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  registerUser,
  teardownTestApp
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /auth/verify-email', () => {
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

  /** Registers a user and returns the emailVerificationToken stored in the DB. */
  async function registerAndGetToken(): Promise<{ email: string; token: string }> {
    const user = createTestUser();
    await registerUser(app, user);

    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });

    if (!dbUser?.emailVerificationToken)
      throw new Error('emailVerificationToken missing after registration');

    return { email: user.email, token: dbUser.emailVerificationToken };
  }

  describe('Success cases', () => {
    it('should verify email and set emailVerified = true in the DB', async () => {
      const { email, token } = await registerAndGetToken();

      const response = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Email verified successfully');

      const updatedUser = await prisma.user.findUnique({ where: { email } });
      expect(updatedUser?.emailVerified).toBe(true);
    });
  });

  describe('Failure cases', () => {
    it('should reject an invalid token with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body.message).toContain('Invalid verification token');
    });

    it('should reject a missing token with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({})
        .expect(400);
    });

    it('should reject an expired token with 400', async () => {
      const { email, token } = await registerAndGetToken();

      // Force expiry to one second in the past
      await prisma.user.update({
        where: { email },
        data: { emailVerificationExpires: new Date(Date.now() - 1_000) },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(400);

      expect(response.body.message).toContain('Verification token has expired');
    });
  });
});