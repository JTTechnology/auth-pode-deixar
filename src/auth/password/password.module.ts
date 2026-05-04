import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SharedAuthModule } from '../shared/shared-auth.module';
import { PasswordController } from './password.controller';
import { PasswordManagementService } from './password-management.service';

@Module({
  imports: [
    SharedAuthModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute for auth endpoints
      },
    ]),
  ],
  controllers: [PasswordController],
  providers: [PasswordManagementService],
  exports: [PasswordManagementService],
})
export class PasswordModule {}