import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthLoggerService } from '../auth-logger.service';
import { PasswordService } from '../shared/password.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class LoginService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private authLogger: AuthLoggerService,
    private passwordService: PasswordService,
  ) {}

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
    const isPasswordValid = await this.passwordService.verify(user.password, dto.password);

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

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        completeName: true,
        email: true,
        role: true,
        phone: true,
        postalCode: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      complete_name: user.completeName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      postal_code: user.postalCode,
      email_verified: user.emailVerified,
      created_at: user.createdAt,
      last_login_at: user.lastLoginAt,
    };
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
      jti: crypto.randomUUID(),
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