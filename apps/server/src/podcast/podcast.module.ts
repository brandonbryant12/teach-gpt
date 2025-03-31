import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScraperModule } from '../scraper/scraper.module';
import { LlmModule } from '../llm/llm.module';
import { TtsModule } from '../tts/tts.module';
import { DrizzleModule } from '../db/drizzle.module';
import { AudioModule } from '../audio/audio.module';
import { PodcastService } from './podcast.service';
import { PodcastController } from './podcast.controller';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScraperModule,
    LlmModule.forRoot(),
    TtsModule.forRoot(),
    DrizzleModule,
    AudioModule,
  ],
  providers: [PodcastService],
  exports: [PodcastService],
  controllers: [PodcastController],
})
export class PodcastModule {}
