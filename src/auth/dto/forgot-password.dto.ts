import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User\'s email address for password reset',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsString()
  email: string;
}