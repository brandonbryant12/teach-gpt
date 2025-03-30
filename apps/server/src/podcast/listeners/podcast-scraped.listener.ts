import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { LlmService } from '../../llm/llm.service';
import {
  PodcastScrapedPayload,
  PodcastContentGeneratedPayload,
  PodcastStatus,
  LlmSummary,
  LlmDialogue,
} from '../interfaces/podcast.interface';
import { PodcastJobHelperService } from '../podcast-job-helper.service';

@Injectable()
export class PodcastScrapedListener {
  private readonly logger = new Logger(PodcastScrapedListener.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly jobHelper: PodcastJobHelperService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('podcast.scraped', { async: true })
  async handlePodcastScraped(payload: PodcastScrapedPayload): Promise<void> {
    const {
      jobId,
      bodyText,
      userId,
      deepDiveOption,
      title: scrapedTitle,
    } = payload;
    const currentStep: PodcastStatus = 'GENERATING_CONTENT';
    this.logger.log(`Handling podcast.scraped for Job ID: ${jobId}`);

    try {
      await this.jobHelper.updateJobStatus(jobId, currentStep);

      // TODO: Refine LLM prompts as needed
      const summaryPrompt = `Generate a concise summary, an appropriate title, estimated duration in minutes (as a number), and key topics (as a JSON string array) for the following text: \n\n${bodyText}`;
      const dialoguePrompt = `Convert the following article text into a podcast dialogue script with speaker labels (e.g., Speaker A, Speaker B). Ensure segments are reasonably sized. Option: ${deepDiveOption}. Text: \n\n${bodyText}`;

      // Call LLM Service in parallel
      const [summaryResult, dialogueResult] = await Promise.all([
        this.llmService.generateJsonResponse<LlmSummary>(summaryPrompt),
        this.llmService.generateJsonResponse<LlmDialogue>(dialoguePrompt),
      ]);

      this.logger.log(`Generated content for Job ID: ${jobId}`);

      // Persist results to DB via helper
      await this.jobHelper.updateJobStatus(jobId, currentStep, {
        title: summaryResult.title ?? scrapedTitle, // Prefer LLM title
        summary: summaryResult,
        transcript: dialogueResult,
      });

      const contentGeneratedPayload: PodcastContentGeneratedPayload = {
        jobId,
        summary: summaryResult,
        dialogue: dialogueResult,
        userId,
      };
      this.eventEmitter.emit(
        'podcast.content_generated',
        contentGeneratedPayload,
      );
    } catch (error) {
      await this.jobHelper.failJob(
        jobId,
        currentStep,
        `Content generation failed: ${error.message}`,
        error,
      );
    }
  }
}
