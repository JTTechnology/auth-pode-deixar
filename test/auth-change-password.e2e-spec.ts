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

describe('PUT /auth/change-password', () => {
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

  it('should change password successfully', async () => {
    const user = createTestUser();
    const tokens = await registerAndVerifyEmail(app, user);
    const accessToken = tokens.accessToken;

    const newPassword = 'NewPassword123!';

    const response = await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: user.password,
        newPassword,
      })
      .expect(200);

    expect(response.body).toHaveProperty(
      'message',
      'Password changed successfully',
    );

    // login com nova senha
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password: newPassword,
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('access_token');
  });

  it('should fail change password with wrong current password', async () => {
    const user = createTestUser();
    const tokens = await registerAndVerifyEmail(app, user);
    const accessToken = tokens.accessToken;

    const response = await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
      })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should fail change password with weak new password', async () => {
    const user = createTestUser();
    const tokens = await registerAndVerifyEmail(app, user);
    const accessToken = tokens.accessToken;

    const response = await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: user.password,
        newPassword: 'weak',
      })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should fail change password without authentication', async () => {
    const user = createTestUser();

    const response = await request(app.getHttpServer())
      .put('/auth/change-password')
      .send({
        currentPassword: user.password,
        newPassword: 'NewPassword123!',
      })
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should fail change password with invalid token', async () => {
    const user = createTestUser();

    const response = await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', 'Bearerinvalid-token')
      .send({
        currentPassword: user.password,
        newPassword: 'NewPassword123!',
      })
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should fail change password with missing current password', async () => {
    const user = createTestUser();
    const tokens = await registerAndVerifyEmail(app, user);
    const accessToken = tokens.accessToken;

    await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        newPassword: 'NewPassword123!',
      })
      .expect(400);
  });

  it('should fail change password with missing new password', async () => {
    const user = createTestUser();
    const tokens = await registerAndVerifyEmail(app, user);
    const accessToken = tokens.accessToken;
    await request(app.getHttpServer())
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: user.password,
      })
      .expect(400);
  });
});