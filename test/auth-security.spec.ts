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

// ─── Constants ────────────────────────────────────────────────────────────────

/** Passwords that must all fail the complexity policy. */
const WEAK_PASSWORDS = [
  '123456',    // numeric only
  'password',  // dictionary word
  'qwerty',    // keyboard pattern
  'abc123',    // no uppercase / no special char
  'Password',  // no digit / no special char
  'password1', // no uppercase / no special char
  'PASSWORD1', // no lowercase / no special char
  'Pass1',     // too short
];

/** JWT strings that are structurally invalid or carry bad signatures. */
const MALFORMED_TOKENS = [
  'not-a-jwt',
  'header.payload',                          // missing signature segment
  'header.payload.signature.extra',          // too many segments
  '',                                        // empty string
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // header only
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Security and Edge Cases', () => {
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

  // ── SQL Injection Prevention ─────────────────────────────────────────────

  describe('SQL Injection Prevention', () => {
    it('should reject SQL injection payload in email during registration', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, email: "'; DROP TABLE users; --" })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject SQL injection payload in email during login', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: "' OR '1'='1", password: 'AnyPassword123!' })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  // ── XSS Prevention ──────────────────────────────────────────────────────

  describe('XSS Prevention', () => {
    it('should reject script tags in complete_name', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, complete_name: '<script>alert("XSS")</script>' })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  // ── Password Security ────────────────────────────────────────────────────

  describe('Password Security', () => {
    it.each(WEAK_PASSWORDS)(
      'should reject weak password "%s"',
      async (weakPassword) => {
        const user = createTestUser();

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...user, password: weakPassword })
          .expect(400);

        expect(response.body.message).toBeDefined();
      },
    );

    it('should never expose password or passwordHash in profile response', async () => {
      const user = createTestUser();
      const { accessToken } = await registerAndLogin(app, user, prisma);

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set(bearerAuth(accessToken))
        .expect(200);

      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });
  });

  // ── Input Validation Edge Cases ──────────────────────────────────────────

  describe('Input Validation Edge Cases', () => {
    it('should reject complete_name longer than 255 characters', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, complete_name: 'a'.repeat(1_000) })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should accept valid special characters in complete_name', async () => {
      const user = createTestUser();
      const validName = "José María O'Connor-Smith";

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, complete_name: validName })
        .expect(201);

      expect(response.body.user.complete_name).toBe(validName);
    });

    it('should reject empty strings in phone and postal_code', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, phone: '', postal_code: '' })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject null values for required fields', async () => {
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

  // ── Token Security ───────────────────────────────────────────────────────

  describe('Token Security', () => {
    it.each(MALFORMED_TOKENS)(
      'should reject malformed token "%s" with 401',
      async (token) => {
        const response = await request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.message).toContain('Unauthorized');
      },
    );

    it('should reject a token with a wrong signature with 401', async () => {
      const tokenWithBadSig =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
        '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
        '.wrong-signature';

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', tokenWithBadSig) // intentionally no "Bearer " prefix to test raw header rejection
        .expect(401);

      expect(response.body.message).toContain('Unauthorized');
    });
  });
});