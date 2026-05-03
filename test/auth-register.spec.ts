import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  teardownTestApp
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /auth/register', () => {
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

  describe('Success cases', () => {
    it('should register a new user and return safe user data', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(user)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: user.email,
        email_verified: false,
        role: user.role,
      });
      expect(response.body.user).not.toHaveProperty('password');
    });
  });

  describe('Conflict cases', () => {
    it('should reject duplicate email with 409', async () => {
      const user = createTestUser();

      await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(user)
        .expect(409);

      expect(response.body.message).toContain('already registered');
    });
  });

  describe('Validation cases', () => {
    it('should reject invalid email format', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, email: 'invalid-email' })
        .expect(400);

      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should reject weak password', async () => {
      const user = createTestUser();

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, password: 'weak' })
        .expect(400);
    });

    it('should reject missing required fields (complete_name + role)', async () => {
      const user = createTestUser();

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: user.email, password: user.password })
        .expect(400);
    });

    it('should reject invalid role value', async () => {
      const user = createTestUser();

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, role: 'INVALID_ROLE' })
        .expect(400);
    });

    it('should reject empty phone', async () => {
      const user = createTestUser();

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, phone: '' })
        .expect(400);
    });

    it('should reject empty postal_code', async () => {
      const user = createTestUser();

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, postal_code: '' })
        .expect(400);
    });

    it('should reject mismatched passwords', async () => {
      const user = createTestUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, confirm_password: 'DifferentPassword123!' })
        .expect(400);

      expect(response.body.message).toContain('do not match');
    });
  });
});