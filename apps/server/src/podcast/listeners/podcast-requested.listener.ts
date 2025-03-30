import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { ScraperService } from '../../scraper/scraper.service';
import {
  PodcastRequestedPayload,
  PodcastScrapedPayload,
  PodcastStatus,
} from '../interfaces/podcast.interface';
import { PodcastJobHelperService } from '../podcast-job-helper.service';

@Injectable()
export class PodcastRequestedListener {
  private readonly logger = new Logger(PodcastRequestedListener.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly jobHelper: PodcastJobHelperService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('podcast.requested', { async: true })
  async handlePodcastRequested(
    payload: PodcastRequestedPayload,
  ): Promise<void> {
    const { jobId, url, userId, deepDiveOption } = payload;
    const currentStep: PodcastStatus = 'SCRAPING';
    this.logger.log(`Handling podcast.requested for Job ID: ${jobId}`);

    try {
      await this.jobHelper.updateJobStatus(jobId, currentStep);

      const scrapeResult = await this.scraperService.scrapeUrl(url);
      this.logger.log(`Scraped content for Job ID: ${jobId}`);

      const scrapedPayload: PodcastScrapedPayload = {
        jobId,
        // Assuming scrapeResult includes title or it's handled later
        title: scrapeResult.title ?? 'Untitled Podcast',
        bodyText: scrapeResult.content,
        userId,
        deepDiveOption,
      };
      this.eventEmitter.emit('podcast.scraped', scrapedPayload);
    } catch (error) {
      await this.jobHelper.failJob(
        jobId,
        currentStep,
        `Scraping failed: ${error.message}`,
        error,
      );
    }
  }
}
