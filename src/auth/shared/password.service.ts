import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  /**
   * Hash a password using Argon2
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  /**
   * Verify a password against its hash
   */
  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}