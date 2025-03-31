import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { AudioService } from './audio.service';

@Module({
  imports: [DrizzleModule],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
