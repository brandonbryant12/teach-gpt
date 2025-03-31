import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { AudioService } from './audio.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DrizzleModule, ConfigModule],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
