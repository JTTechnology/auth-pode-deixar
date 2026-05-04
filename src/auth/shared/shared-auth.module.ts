import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../jwt.strategy';
import { AuthLoggerService } from '../auth-logger.service';
import { EmailService } from '../email.service';
import { PasswordService } from './password.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret-key',
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    JwtStrategy,
    AuthLoggerService,
    EmailService,
    PasswordService,
  ],
  exports: [
    JwtStrategy,
    AuthLoggerService,
    EmailService,
    PasswordService,
    PassportModule,
    JwtModule,
    PrismaModule,
  ],
})
export class SharedAuthModule {}