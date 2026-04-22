import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    console.log('SMTP_HOST:', this.configService.get('SMTP_HOST'));
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendEmailVerification(email: string, token: string) {
    const verificationUrl = `${this.configService.get<string>('FRONTEND_URL')}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM') || 'noreply@yourapp.com',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <h1>Welcome!</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
    });

    return true;
  }

  async sendPasswordReset(email: string, token: string) {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM') || 'noreply@yourapp.com',
      to: email,
      subject: 'Reset Your Password',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }
}