import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  MaxLength
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User\'s complete name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[\p{L}\s'-]+$/u, {
    message: 'complete_name contains invalid characters',
  })
  complete_name: string;

  @ApiProperty({
    description: 'User\'s email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsString()
  email: string;

  @ApiProperty({
    description: 'User\'s password (minimum 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/,
    {
      message:
        'weak password: minimun 8 characters, 1 upper, 1 lower, 1 number e 1 especial',
    },
  )
  password: string;

  @ApiProperty({
    description: 'User\'s password confirmation (must match password field)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  confirm_password: string;

  @ApiProperty({
    description: 'User\'s phone number',
    example: '+1234567890',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'User\'s postal code',
    example: '12345-678',
  })
  @IsString()
  @IsNotEmpty()
  postal_code: string;

  @ApiProperty({
    description: 'User role',
    enum: ['CLIENT', 'PROVIDER'],
    example: 'CLIENT',
  })
  @IsEnum(['CLIENT', 'PROVIDER'])
  role: 'CLIENT' | 'PROVIDER';
}
