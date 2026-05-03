import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/auth/email.service';
import { ThrottlerModule } from '@nestjs/throttler';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestUser {
  complete_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone: string;
  postal_code: string;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TestAppSetup {
  app: INestApplication<App>;
  prisma: PrismaService;
}

// ─── User Factories ───────────────────────────────────────────────────────────

/**
 * Creates a unique test user to avoid email collisions across parallel runs.
 * Uses both Date.now() and Math.random() for uniqueness.
 */
export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  complete_name: 'Test User',
  email: `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
  password: 'TestPassword123!',
  confirm_password: 'TestPassword123!',
  phone: '+1234567890',
  postal_code: '12345-678',
  role: 'CLIENT',
  ...overrides,
});

export const createProviderUser = (overrides: Partial<TestUser> = {}): TestUser =>
  createTestUser({ complete_name: 'Provider User', role: 'PROVIDER', ...overrides });

export const createAdminUser = (overrides: Partial<TestUser> = {}): TestUser =>
  createTestUser({ complete_name: 'Admin User', role: 'ADMIN', ...overrides });

// ─── App Lifecycle ────────────────────────────────────────────────────────────

/**
 * Bootstraps the NestJS app for E2E tests.
 * - Overrides EmailService to prevent real emails being sent.
 * - Sets a high throttle limit so rate limiting doesn't interfere with tests.
 * - Applies the same ValidationPipe configuration used in production.
 */
export async function setupTestApp(): Promise<TestAppSetup> {
  const moduleFixture = await Test.createTestingModule({
    imports: [
      AppModule,
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10_000 }]),
    ],
  })
    .overrideProvider(EmailService)
    .useValue({
      sendEmailVerification: jest.fn().mockResolvedValue(true),
      sendPasswordReset: jest.fn().mockResolvedValue(true),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const prisma = moduleFixture.get(PrismaService);

  return { app, prisma };
}

// ─── Auth Flow Helpers ────────────────────────────────────────────────────────

/**
 * Registers a user via the API and asserts HTTP 201.
 */
export async function registerUser(
  app: INestApplication,
  user: TestUser,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/auth/register')
    .send(user)
    .expect(201);
}

/**
 * Fetches the email verification token directly from the DB and calls the
 * verify-email endpoint. Throws descriptive errors if the user or token is
 * missing so test failures are easy to diagnose.
 */
export async function verifyEmailViaApi(
  app: INestApplication,
  email: string,
  prisma?: PrismaService,
): Promise<void> {
  const db: PrismaService = prisma ?? app.get(PrismaService);

  const user = await db.user.findUnique({ where: { email } });

  if (!user) throw new Error(`[verifyEmailViaApi] User not found: ${email}`);
  if (!user.emailVerificationToken)
    throw new Error(
      `[verifyEmailViaApi] emailVerificationToken is missing for ${email}. ` +
        'Check the registration flow.',
    );

  await request(app.getHttpServer())
    .post('/auth/verify-email')
    .send({ token: user.emailVerificationToken })
    .expect(200);
}

/**
 * Logs in an already-registered and verified user. Asserts HTTP 200.
 */
export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
}

/**
 * Full happy-path shortcut: register → verify email → login.
 * Returns typed access/refresh tokens ready for use in test assertions.
 */
export async function registerAndLogin(
  app: INestApplication,
  user: TestUser,
  prisma?: PrismaService,
): Promise<AuthTokens> {
  await registerUser(app, user);
  await verifyEmailViaApi(app, user.email, prisma);

  const loginResponse = await loginUser(app, user.email, user.password);

  return {
    accessToken: loginResponse.body.access_token as string,
    refreshToken: loginResponse.body.refresh_token as string,
  };
}

/**
 * Elevates an existing user to ADMIN role directly in the DB.
 * Useful for tests that need admin access without going through a separate
 * admin-creation flow.
 */
export async function promoteToAdmin(
  prisma: PrismaService,
  email: string,
): Promise<void> {
  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
    select: { role: true },
  });

  if (updated.role !== 'ADMIN') {
    throw new Error(
      `[promoteToAdmin] Failed to promote ${email} — role is still ${updated.role}`,
    );
  }
}

/**
 * Returns a bearer-auth header object for use with supertest's .set().
 */
export const bearerAuth = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export async function teardownTestApp(
  app: INestApplication,
  prisma: PrismaService,
): Promise<void> {
  await prisma.$disconnect(); // fecha conexão com banco
  await app.close();          // fecha HTTP server do Nest
}