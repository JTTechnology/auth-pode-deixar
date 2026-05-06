import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SharedAuthModule } from '../shared/shared-auth.module';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';

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
  controllers: [LoginController],
  providers: [LoginService],
  exports: [LoginService],
})
export class LoginModule {}