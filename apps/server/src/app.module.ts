import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { DrizzleModule } from './db/drizzle.module';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from './llm/llm.module';
import { TtsModule } from './tts/tts.module';
import { validate } from './config/env.validation';
import { PodcastModule } from './podcast/podcast.module';
import { ScraperModule } from './scraper/scraper.module';
import { AudioModule } from './audio/audio.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      validate,
    }),
    LlmModule.forRoot(),
    TtsModule.forRoot(),
    UserModule,
    AuthModule,
    DrizzleModule,
    ScraperModule,
    PodcastModule,
    AudioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
