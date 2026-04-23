import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } from './test-setup';
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
    await cleanupDatabase(prisma);
    await teardownTestApp(app);
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  it('should register a new user successfully', async () => {
    const user = createTestUser();

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.email_verified).toBe(false);
    expect(response.body.user.role).toBe(user.role);
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should fail registration with duplicate email', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(409);

    expect(response.body.message).toContain('already registered');
  });

  it('should fail registration with invalid email', async () => {
    const user = createTestUser();

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...user, email: 'invalid-email' })
      .expect(400);

    expect(Array.isArray(response.body.message)).toBe(true);
  });

  it('should fail registration with weak password', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...user, password: 'weak' })
      .expect(400);
  });

  it('should fail registration with missing required fields', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user.email, password: user.password })
      .expect(400);
  });

  it('should fail registration with invalid role', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...user, role: 'INVALID_ROLE' })
      .expect(400);
  });

  it('should fail registration with empty phone', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...user, phone: '' })
      .expect(400);
  });

  it('should fail registration with empty postal_code', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...user, postal_code: '' })
      .expect(400);
  });
});