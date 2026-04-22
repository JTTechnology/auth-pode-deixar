import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/auth/email.service';
import { ThrottlerModule } from '@nestjs/throttler';

export const createTestUser = (overrides: Partial<any> = {}) => ({
  complete_name: "Test User",
  email: `test_${Date.now()}_${Math.random()}@gmail.com`,
  password: "TestPassword123!",
  phone: "+1234567890",
  postal_code: "12345-678",
  role: "CLIENT",
  ...overrides,
});

export const createProviderUser = () =>
  createTestUser({ role: 'PROVIDER' });

export const createAdminUser = () =>
  createTestUser({ role: 'ADMIN' });

export async function setupTestApp(): Promise<{
  app: INestApplication<App>;
  prisma: PrismaService;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      AppModule,
      ThrottlerModule.forRoot([
        {
          ttl: 60000,
          limit: 10000,
        },
      ]),
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

  const prisma = app.get(PrismaService);

  await app.init();

  return { app, prisma };
}

export async function cleanupDatabase(prisma: PrismaService): Promise<void> {
  await prisma.user.deleteMany();
}

export async function registerUser(
  app: INestApplication,
  user: any,
) {
  return request(app.getHttpServer())
    .post('/auth/register')
    .send(user)
    .expect(201);
}

/**
 * ✔ SIMPLES E CONFIÁVEL
 * Não depende de token nem endpoint
 */
export async function forceVerifyEmail(
  app: INestApplication,
  email: string,
  prisma?: PrismaService,
) {
  const dbPrisma = prisma || (app as any).get(PrismaService);

  await dbPrisma.user.update({
    where: { email },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
    },
  });
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
) {
  return request(app.getHttpServer())
    .post('/auth/login')
    .send({email: email, password: password })
    .expect(200);
}

/**
 * ✔ fluxo padrão para quase todos os testes
 */
export async function registerAndLogin(
  app: INestApplication,
  user: any,
  prisma?: PrismaService,
) {
  await registerUser(app, user);

  await forceVerifyEmail(app, user.email, prisma);

  const loginResponse = await loginUser(app, user.email, user.password);

  return {
    accessToken: loginResponse.body.access_token as string,
    refreshToken: loginResponse.body.refresh_token as string,
  };
}

/**
 * ✔ se realmente precisar simular verify-email
 */
export async function registerAndVerifyEmail(
  app: INestApplication,
  user: any,
  prisma?: PrismaService,
) {
  await registerUser(app, user);

  const dbPrisma = prisma || (app as any).get(PrismaService);

  const dbUser = await dbPrisma.user.findUnique({
    where: { email: user.email },
  });

  if (!dbUser) {
    throw new Error('User not found');
  }

  const token = dbUser.emailVerificationToken ?? 'test-token';

  await dbPrisma.user.update({
    where: { email: user.email },
    data: {
      emailVerificationToken: token,
    },
  });

  await request(app.getHttpServer())
    .post('/auth/verify-email')
    .send({ token: token })
    .expect(200);

  const loginResponse = await loginUser(app, user.email, user.password);

  return {
    accessToken: loginResponse.body.access_token as string,
    refreshToken: loginResponse.body.refresh_token as string,
    verificationToken: token,
  };
}