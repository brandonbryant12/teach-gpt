import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScraperService } from './scraper.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000, // Default timeout for HTTP requests in this module
      maxRedirects: 5, // Default max redirects
    }),
  ],
  providers: [ScraperService],
  exports: [ScraperService], // Export if other modules need to inject it
})
export class ScraperModule {}
