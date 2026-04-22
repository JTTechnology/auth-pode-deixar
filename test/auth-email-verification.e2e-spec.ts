import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  cleanupDatabase,
  createTestUser
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
    await cleanupDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  it('should verify email successfully', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    const verificationToken = dbUser?.emailVerificationToken || '';

    const response = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: verificationToken })
      .expect(200);

    expect(response.body).toHaveProperty('message', 'Email verified successfully');

    const updatedUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    expect(updatedUser?.emailVerified).toBe(true);
  });

  it('should fail verification with invalid token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: 'invalid-token' })
      .expect(400);

    expect(response.body.message).toContain('Invalid verification token');
  });

  it('should fail verification with missing token', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({})
      .expect(400);
  });

  it('should fail verification with expired token', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    const verificationToken = dbUser?.emailVerificationToken || '';

    await prisma.user.update({
      where: { email: user.email },
      data: {
        emailVerificationExpires: new Date(Date.now() - 1000),
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: verificationToken })
      .expect(400);

    expect(response.body.message).toContain('Verification token has expired');
  });
});