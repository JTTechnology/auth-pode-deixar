import { Injectable, Logger } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class AuthLoggerService extends Logger {
  private winstonLogger: winston.Logger;

  constructor() {
    super('AuthLogger');
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'auth-service' },
      transports: [
        new winston.transports.File({ filename: 'logs/auth-security.log' }),
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  logLoginAttempt(email: string, success: boolean, ip?: string, userAgent?: string) {
    this.winstonLogger.info('Login attempt', {
      event: 'login_attempt',
      email,
      success,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  logRegistration(email: string, role: string, ip?: string) {
    this.winstonLogger.info('User registration', {
      event: 'user_registration',
      email,
      role,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  logPasswordReset(email: string, success: boolean) {
    this.winstonLogger.info('Password reset', {
      event: 'password_reset',
      email,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  logTokenRefresh(userId: string, success: boolean) {
    this.winstonLogger.info('Token refresh', {
      event: 'token_refresh',
      userId,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  logSecurityEvent(event: string, details: any) {
    this.winstonLogger.warn('Security event', {
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}