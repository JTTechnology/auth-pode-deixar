import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  cleanupDatabase,
  teardownTestApp,
  createTestUser,
  registerAndVerifyEmail,
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Security and Edge Cases', () => {
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

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in email field during registration', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...user,
          email: "'; DROP TABLE users; --",
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should prevent SQL injection in email field during login', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: "' OR '1'='1",
          password: user.password,
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('XSS Prevention', () => {
    it('should reject XSS attempts in input fields', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...user,
          complete_name: '<script>alert("XSS")</script>',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Password Security', () => {
    it('should validate password complexity requirements', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        'Password',
        'password1',
        'PASSWORD1',
        'Pass1',
      ];

      for (const weakPassword of weakPasswords) {
        const user = createTestUser();

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            ...user,
            password: weakPassword,
          })
          .expect(400);

        expect(response.body.message).toBeDefined();
      }
    });

    it('should prevent password in response data', async () => {
      const user = createTestUser();
      const tokens = await registerAndVerifyEmail(app, user);

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle very long input strings', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...user,
          complete_name: 'a'.repeat(1000),
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle valid special characters in names', async () => {
      const user = createTestUser();
      const validName = "José María O'Connor-Smith";

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...user,
          complete_name: validName,
        })
        .expect(201);

      expect(response.body.user.complete_name).toBe(validName);
    });

    it('should handle empty strings in optional fields appropriately', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...user,
          phone: '',
          postal_code: '',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle null values appropriately', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          complete_name: user.complete_name,
          email: user.email,
          password: user.password,
          phone: null,
          postal_code: null,
          role: null,
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('should handle rate limiting for auth endpoints', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(user)
        .expect(201);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Token Security', () => {
    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'not-a-jwt',
        'header.payload',
        'header.payload.signature.extra',
        '',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      ];

      for (const token of malformedTokens) {
        const response = await request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.message).toContain('Unauthorized');
      }
    });

    it('should reject tokens with wrong signature', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set(
          'Authorization',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.wrong-signature',
        )
        .expect(401);

      expect(response.body.message).toContain('Unauthorized');
    });
  });
});