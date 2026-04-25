import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  createTestUser,
  registerUser,
  verifyEmailViaApi,
  teardownTestApp
} from './test-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /auth/login', () => {
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
    it('should return tokens and safe user data on valid credentials', async () => {
      const user = createTestUser();
      await registerUser(app, user);
      await verifyEmailViaApi(app, user.email, prisma);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        token_type: 'Bearer',
      });
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return tokens when rememberMe is true', async () => {
      const user = createTestUser();
      await registerUser(app, user);
      await verifyEmailViaApi(app, user.email, prisma);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password, rememberMe: true })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });
  });

  describe('Authentication failure cases', () => {
    it('should reject incorrect password with 401', async () => {
      const user = createTestUser();
      await registerUser(app, user);
      await verifyEmailViaApi(app, user.email, prisma);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'WrongPassword123!' })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject non-existent email with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'AnyPassword123!' })
        .expect(401);
    });
  });

  describe('Validation cases', () => {
    it('should reject invalid email format with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'invalid-email', password: 'AnyPassword123!' })
        .expect(400);
    });

    it('should reject missing password with 400', async () => {
      const user = createTestUser();

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email })
        .expect(400);
    });
  });
});