import { IsEmail, IsString } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  @IsString()
  email: string;
}