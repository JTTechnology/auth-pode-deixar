import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from '../src/auth/email.service';

// ─── Nodemailer mock ──────────────────────────────────────────────────────────

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFIG: Record<string, string | number> = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_USER: 'user@example.com',
  SMTP_PASS: 'secret',
  SMTP_FROM: 'noreply@example.com',
  FRONTEND_URL: 'https://app.example.com',
};

function buildConfigService(overrides: Partial<typeof CONFIG> = {}): Partial<ConfigService> {
  const config = { ...CONFIG, ...overrides };
  return {
    get: jest.fn(<T = string>(key: string): T => config[key] as unknown as T),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;
  let configService: Partial<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

    configService = buildConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  // ── Constructor / transport setup ──────────────────────────────────────────

  describe('Transporter setup', () => {
    it('should call nodemailer.createTransport with values from ConfigService', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: CONFIG.SMTP_HOST,
        port: CONFIG.SMTP_PORT,
        secure: false,
        auth: {
          user: CONFIG.SMTP_USER,
          pass: CONFIG.SMTP_PASS,
        },
      });
    });

    it('should default SMTP_PORT to 587 when config value is missing', async () => {
      jest.clearAllMocks();

      const configWithoutPort = buildConfigService({ SMTP_PORT: undefined as any });

      await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: configWithoutPort },
        ],
      }).compile();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 587 }),
      );
    });
  });

  // ── sendEmailVerification ──────────────────────────────────────────────────

  describe('sendEmailVerification()', () => {
    const EMAIL = 'user@test.com';
    const TOKEN = 'verification-token-abc';

    it('should call sendMail with correct recipient and subject', async () => {
      await service.sendEmailVerification(EMAIL, TOKEN);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: EMAIL,
          subject: 'Verify Your Email Address',
        }),
      );
    });

    it('should include the verification URL with the token in the email body', async () => {
      await service.sendEmailVerification(EMAIL, TOKEN);

      const callArgs = mockSendMail.mock.calls[0][0];
      const expectedUrl = `${CONFIG.FRONTEND_URL}/verify-email?token=${TOKEN}`;
      expect(callArgs.html).toContain(expectedUrl);
    });

    it('should use SMTP_FROM as the sender address', async () => {
      await service.sendEmailVerification(EMAIL, TOKEN);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: CONFIG.SMTP_FROM }),
      );
    });

    it('should fall back to default sender when SMTP_FROM is not configured', async () => {
      jest.clearAllMocks();
      mockSendMail.mockResolvedValue({});

      const configWithoutFrom = buildConfigService({ SMTP_FROM: undefined as any });
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: configWithoutFrom },
        ],
      }).compile();

      const svc = module.get<EmailService>(EmailService);
      await svc.sendEmailVerification(EMAIL, TOKEN);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'noreply@yourapp.com' }),
      );
    });

    it('should return true on success', async () => {
      const result = await service.sendEmailVerification(EMAIL, TOKEN);
      expect(result).toBe(true);
    });

    it('should propagate errors thrown by the transporter', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

      await expect(service.sendEmailVerification(EMAIL, TOKEN)).rejects.toThrow(
        'SMTP connection refused',
      );
    });
  });

  // ── sendPasswordReset ──────────────────────────────────────────────────────

  describe('sendPasswordReset()', () => {
    const EMAIL = 'user@test.com';
    const TOKEN = 'reset-token-xyz';

    it('should call sendMail with correct recipient and subject', async () => {
      await service.sendPasswordReset(EMAIL, TOKEN);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: EMAIL,
          subject: 'Reset Your Password',
        }),
      );
    });

    it('should include the password reset URL with the token in the email body', async () => {
      await service.sendPasswordReset(EMAIL, TOKEN);

      const callArgs = mockSendMail.mock.calls[0][0];
      const expectedUrl = `${CONFIG.FRONTEND_URL}/reset-password?token=${TOKEN}`;
      expect(callArgs.html).toContain(expectedUrl);
    });

    it('should use SMTP_FROM as the sender address', async () => {
      await service.sendPasswordReset(EMAIL, TOKEN);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: CONFIG.SMTP_FROM }),
      );
    });

    it('should fall back to default sender when SMTP_FROM is not configured', async () => {
      jest.clearAllMocks();
      mockSendMail.mockResolvedValue({});

      const configWithoutFrom = buildConfigService({ SMTP_FROM: undefined as any });
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: configWithoutFrom },
        ],
      }).compile();

      const svc = module.get<EmailService>(EmailService);
      await svc.sendPasswordReset(EMAIL, TOKEN);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'noreply@yourapp.com' }),
      );
    });

    it('should propagate errors thrown by the transporter', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP timeout'));

      await expect(service.sendPasswordReset(EMAIL, TOKEN)).rejects.toThrow(
        'SMTP timeout',
      );
    });
  });
});