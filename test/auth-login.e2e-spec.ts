import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  setupTestApp,
  cleanupDatabase,
  teardownTestApp,
  createTestUser,
  registerAndVerifyEmail
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
    await cleanupDatabase(prisma);
    await teardownTestApp(app);
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  it('should login successfully with correct credentials', async () => {
    const user = createTestUser();

    await registerAndVerifyEmail(app, user);

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

  it('should login successfully with rememberMe = true', async () => {
    const user = createTestUser();

    await registerAndVerifyEmail(app, user);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password: user.password,
        rememberMe: true,
      })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
  });

  it('should fail login with incorrect password', async () => {
    const user = createTestUser();

    await registerAndVerifyEmail(app, user);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'WrongPassword123!' })
      .expect(401);

    expect(response.body.message).toContain('Invalid credentials');
  });

  it('should fail login with non-existent email', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'AnyPassword123!',
      })
      .expect(401);
  });

  it('should fail login with invalid email format', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'invalid-email',
        password: 'AnyPassword123!',
      })
      .expect(400);
  });

  it('should fail login with missing password', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email })
      .expect(400);
  });
});