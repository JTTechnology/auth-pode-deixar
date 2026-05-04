import { Module } from '@nestjs/common';
import { LoginModule } from './login/login.module';
import { RegisterModule } from './register/register.module';
import { PasswordModule } from './password/password.module';

@Module({
  imports: [
    LoginModule,
    RegisterModule,
    PasswordModule,
  ],
  exports: [
    LoginModule,
    RegisterModule,
    PasswordModule,
  ],
})
export class AuthModule {}