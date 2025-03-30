import { Module } from '@nestjs/common';
import { PodcastService } from './podcast.service';
import { PodcastController } from './podcast.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DrizzleModule } from '../db/drizzle.module';
import { ScraperModule } from '../scraper/scraper.module';
import { LlmModule } from '../llm/llm.module';
import { TtsModule } from '../tts/tts.module';

// Import the new helper service and individual listeners
import { PodcastJobHelperService } from './podcast-job-helper.service';
import { PodcastRequestedListener } from './listeners/podcast-requested.listener';
import { PodcastScrapedListener } from './listeners/podcast-scraped.listener';
import { PodcastContentGeneratedListener } from './listeners/podcast-content-generated.listener';
import { SegmentAudioRequestedListener } from './listeners/podcast-segment-audio-requested.listener';
import { SegmentAudioGeneratedListener } from './listeners/podcast-segment-audio-generated.listener';
import { AllAudioGeneratedListener } from './listeners/all-audio-generated.listener';
import { PodcastTerminalListener } from './listeners/podcast-terminal.listener';

@Module({
  imports: [
    // No need to call forRoot() for EventEmitterModule if it's already done globally in AppModule
    // EventEmitterModule.forRoot(),
    DrizzleModule,
    ScraperModule,
    LlmModule,
    TtsModule,
    // AuthModule is imported globally
  ],
  controllers: [PodcastController],
  providers: [
    PodcastService,
    // Add the helper service
    PodcastJobHelperService,
    // Add all the individual listener classes
    PodcastRequestedListener,
    PodcastScrapedListener,
    PodcastContentGeneratedListener,
    SegmentAudioRequestedListener,
    SegmentAudioGeneratedListener,
    AllAudioGeneratedListener,
    PodcastTerminalListener,
  ],
  exports: [PodcastService],
})
export class PodcastModule {}
