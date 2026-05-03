import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthLoggerService } from './auth-logger.service';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private authLogger: AuthLoggerService,
    private emailService: EmailService,
  ) { }

  async register(dto: RegisterDto, ip?: string) {
    // Check if password and confirm_password match
    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Generate email verification token and expiration (24 hours)
    const emailVerificationToken = uuidv4();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await this.prisma.user.create({
      data: {
        completeName: dto.complete_name,
        email: dto.email,
        password: passwordHash,
        role: dto.role,
        phone: dto.phone,
        postalCode: dto.postal_code,
        emailVerificationToken,
        emailVerificationExpires,
      },
      select: {
        id: true,
        completeName: true,
        email: true,
        role: true,
        phone: true,
        postalCode: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Send verification email
    try {
      await this.emailService.sendEmailVerification(dto.email, emailVerificationToken);
    } catch (error) {
      this.authLogger.logSecurityEvent('email_send_failed', {
        email: dto.email,
        type: 'verification',
        error: error.message,
      });
    }

    // Log registration
    this.authLogger.logRegistration(dto.email, dto.role, ip);

    return {
      message: 'User registered successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        complete_name: user.completeName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        postal_code: user.postalCode,
        email_verified: user.emailVerified,
        created_at: user.createdAt,
      },
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.authLogger.logLoginAttempt(dto.email, false, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      this.authLogger.logSecurityEvent('account_locked_attempt', {
        email: dto.email,
        lockoutUntil: user.lockoutUntil,
        ip,
      });
      throw new ForbiddenException('Account is temporarily locked due to multiple failed login attempts');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.password, dto.password);

    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const maxAttempts = this.configService.get<number>('MAX_LOGIN_ATTEMPTS') || 5;
      const lockoutDuration = this.configService.get<number>('LOCKOUT_DURATION_MINUTES') || 15;

      if (newAttempts >= maxAttempts) {
        const lockoutUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);

        await this.prisma.user.updateMany({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockoutUntil,
          },
        });

        this.authLogger.logSecurityEvent('account_locked', {
          email: dto.email,
          attempts: newAttempts,
          lockoutUntil,
          ip,
        });

        throw new ForbiddenException('Account locked due to multiple failed attempts');
      } else {
        await this.prisma.user.updateMany({
          where: { id: user.id },
          data: { failedLoginAttempts: newAttempts },
        });
      }

      this.authLogger.logLoginAttempt(dto.email, false, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    // Reset failed attempts and update last login
    await this.prisma.user.updateMany({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    // Store refresh token
    await this.prisma.user.updateMany({
      where: { id: user.id },
      data: {
        refreshToken: this.hashRefreshToken(refreshToken),
      },
    });

    const expiresIn = dto.rememberMe ? 30 * 24 * 60 * 60 : 15 * 60;

    this.authLogger.logLoginAttempt(dto.email, true, ip, userAgent);

    return {
      message: 'Login successful',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: 'Bearer',
      user: {
        id: user.id,
        complete_name: user.completeName,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key',
      });

      const hashedIncoming = this.hashRefreshToken(dto.refreshToken);

      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, refreshToken: hashedIncoming },
      });

      if (!user) {
        await this.prisma.user.updateMany({
          where: { id: payload.sub },
          data: { refreshToken: null },
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });

      const newAccessToken = await this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: this.hashRefreshToken(newRefreshToken) },
      });

      this.authLogger.logTokenRefresh(user.id, true);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.authLogger.logTokenRefresh('unknown', false);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Check if token has expired
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification token has expired. Please request a new verification email.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return {
      message: 'Email verified successfully',
    };
  }

  async resendVerificationEmail(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return { message: 'If the email exists, a new verification link has been sent' };
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token and expiration
    const emailVerificationToken = uuidv4();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Send verification email
    try {
      await this.emailService.sendEmailVerification(dto.email, emailVerificationToken);
    } catch (error) {
      this.authLogger.logSecurityEvent('email_send_failed', {
        email: dto.email,
        type: 'verification',
        error: error.message,
      });
    }

    return { message: 'If the email exists, a new verification link has been sent' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a password reset link has been sent' };
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: expiresAt,
      },
    });

    try {
      await this.emailService.sendPasswordReset(dto.email, resetToken);
      this.authLogger.logPasswordReset(dto.email, true);
    } catch (error) {
      this.authLogger.logPasswordReset(dto.email, false);
    }

    return { message: 'If the email exists, a password reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await argon2.verify(user.password, dto.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logged out successfully' };
  }

  private async generateAccessToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret-key',
      expiresIn: '15m',
    });
  }

  private async generateRefreshToken(user: any) {
    const payload = {
      sub: user.id,
      type: 'refresh',
      jti: uuidv4(),
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key',
      expiresIn: '7d',
    });
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}