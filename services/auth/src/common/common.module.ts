import { Module } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

@Module({
  providers: [GlobalExceptionFilter],
  exports: [GlobalExceptionFilter],
})
export class CommonModule {}