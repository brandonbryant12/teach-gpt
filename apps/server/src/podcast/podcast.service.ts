/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { PG_CONNECTION } from '../db/drizzle.constants';
import * as schema from '../db/schema';
import {
  PodcastRequestResponseDto,
  PodcastRequestedPayload,
  PodcastScrapedPayload,
  DeepDiveOptionType,
  PodcastJobStatusDto,
  PodcastContentGeneratedPayload,
  Summary,
  Dialogue,
  Segment,
  PodcastSegmentAudioRequestedPayload,
  PodcastSegmentAudioGeneratedPayload,
  PodcastCompletedPayload,
} from './dto/podcast.dto';
import { ScraperService } from '../scraper/scraper.service';
import { ScrapeResult } from '../scraper/scraper.types';
import { LlmService, LlmError } from '../llm/llm.service';
import { TtsService, TtsError } from '../tts/tts.service';
import { AudioService } from '../audio/audio.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Base path for temporary segment storage (consider moving to config)
const BASE_TEMP_DIR = path.resolve(__dirname, '../../../tmp/podcast_jobs'); // Adjusted path

// In-memory store for tracking completed segments per job (Needs enhancement for production)
interface JobCompletionState {
  completedCount: number;
  totalSegments: number;
  userId?: number;
}
const jobCompletionTracker = new Map<number, JobCompletionState>();

// Define schema descriptions based on the DTOs
const summarySchemaDescription = `
Interface Summary {
  title: string; // A concise title for the summary.
  summaryPoints: string[]; // An array of key takeaways or bullet points summarizing the content.
}`;

const dialogueSchemaDescription = `
Interface Segment {
  speaker: string; // Identifier for the speaker (e.g., "Host 1", "Host 2", "Narrator").
  text: string; // The spoken text for this segment.
}

Interface Dialogue {
  title: string; // The title of the podcast episode or discussion.
  segments: Segment[]; // An array of dialogue segments representing the conversation flow.
}`;

@Injectable()
export class PodcastService {
  private readonly logger = new Logger(PodcastService.name);

  constructor(
    @Inject(PG_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private eventEmitter: EventEmitter2,
    private readonly scraperService: ScraperService,
    private readonly llmService: LlmService,
    private readonly ttsService: TtsService,
    private readonly audioService: AudioService,
  ) {}

  // Helper to get UserId (Added from segment-audio-generated.listener.ts)
  private async getUserIdForJob(jobId: number): Promise<number | undefined> {
    // This is a placeholder. Fetch the actual userId associated with the job.
    try {
      const result = await this.db
        .select({ userId: schema.podcasts.userId })
        .from(schema.podcasts)
        .where(eq(schema.podcasts.id, jobId))
        .limit(1);
      return result[0]?.userId;
    } catch (err) {
      this.logger.error(
        `Job ID: ${jobId} - Failed to fetch userId for completion event`,
        err,
      );
      return undefined; // Handle error case appropriately
    }
  }

  /**
   * Initiates the podcast creation process.
   *
   * 1. Validates the request (basic validation done by Controller DTO).
   * 2. Creates a job record in the database with 'PENDING' status.
   * 3. Emits a 'podcast.requested' event to trigger background processing.
   * 4. Returns the job ID and status immediately.
   *
   * @param url The URL of the content to be podcastified.
   * @param userId The ID of the user requesting the podcast.
   * @param options Configuration options, including the deep dive strategy.
   * @returns A DTO containing the job ID and initial status.
   * @throws Error if the database insertion fails.
   */
  async requestPodcastCreation(
    url: string,
    userId: number,
    options: { deepDiveOption: DeepDiveOptionType },
  ): Promise<PodcastRequestResponseDto> {
    this.logger.log(
      `Received podcast request: url=${url}, userId=${userId}, options=${JSON.stringify(options)}`,
    );

    try {
      // 1. Insert job record into the database
      const [newPodcastJob] = await this.db
        .insert(schema.podcasts)
        .values({
          userId,
          url,
          deepDiveOption: options.deepDiveOption,
          status: 'PENDING',
        })
        .returning({ id: schema.podcasts.id });

      const jobId = newPodcastJob.id;
      this.logger.log(`Podcast job created with ID: ${jobId as number}`);

      // 2. Emit event to trigger background processing
      const payload: PodcastRequestedPayload = {
        jobId,
        url,
        userId,
        deepDiveOption: options.deepDiveOption,
      };
      this.eventEmitter.emit('podcast.requested', payload);
      this.logger.log(
        `Emitted 'podcast.requested' event for job ID: ${jobId as number}`,
      );

      // 3. Return the job ID and status
      return {
        jobId,
        status: 'PENDING',
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to create podcast job for url=${url}, userId=${userId}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Failed to create podcast job for url=${url}, userId=${userId}. Unexpected error type: ${String(error)}`,
        );
      }
      throw error;
    }
  }

  /**
   * Handles the 'podcast.requested' event.
   * Updates the job status to SCRAPING, invokes the scraper service,
   * and emits 'podcast.scraped' on success or updates status to FAILED on error.
   * @param payload Data related to the requested podcast job.
   */
  @OnEvent('podcast.requested', { async: true })
  async handlePodcastRequested(
    payload: PodcastRequestedPayload,
  ): Promise<void> {
    const { jobId, url, userId, deepDiveOption } = payload;
    this.logger.log(
      `Handling podcast.requested for Job ID: ${jobId} - URL: ${url}`,
    );

    try {
      // Update status to SCRAPING
      await this.db
        .update(schema.podcasts)
        .set({ status: 'SCRAPING', updatedAt: new Date() })
        .where(eq(schema.podcasts.id, jobId));
      this.logger.log(`Job ID: ${jobId} status updated to SCRAPING`);

      // Invoke Scraper Service
      const scrapeResult: ScrapeResult =
        await this.scraperService.scrapeUrl(url);
      this.logger.log(
        `Job ID: ${jobId} scraping successful. Title: ${scrapeResult.title.substring(0, 50)}...`,
      );

      // Handle Success: Update status and emit next event
      await this.db
        .update(schema.podcasts)
        .set({
          status: 'GENERATING_CONTENT',
          title: scrapeResult.title, // Persist title
          updatedAt: new Date(),
        })
        .where(eq(schema.podcasts.id, jobId));

      const nextPayload: PodcastScrapedPayload = {
        jobId,
        title: scrapeResult.title,
        bodyText: scrapeResult.bodyText,
        userId,
        deepDiveOption,
      };
      this.eventEmitter.emit('podcast.scraped', nextPayload);
      this.logger.log(
        `Job ID: ${jobId} status updated to GENERATING_CONTENT. Emitted podcast.scraped event.`,
      );
    } catch (error) {
      // Handle Failure
      let errorMessage = 'Unknown scraping error';
      let errorStack: string | undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      }
      // Potentially handle other error types here if needed, e.g.:
      // else { errorMessage = String(error); }

      this.logger.error(
        `Job ID: ${jobId} failed during SCRAPING step. Error: ${errorMessage}`,
        errorStack, // Pass the potentially undefined stack
      );

      await this.db
        .update(schema.podcasts)
        .set({
          status: 'FAILED',
          errorMessage: errorMessage, // Use the determined message
          errorStep: 'SCRAPING',
          updatedAt: new Date(),
        })
        .where(eq(schema.podcasts.id, jobId));

      // Optional: Emit failure event
      // this.eventEmitter.emit('podcast.failed', { jobId, errorStep: 'SCRAPING', errorMessage });
    }
  }

  @OnEvent('podcast.scraped', { async: true })
  async handlePodcastScraped(payload: PodcastScrapedPayload): Promise<void> {
    const { jobId, title, bodyText, userId, deepDiveOption } = payload;
    this.logger.log(
      `Handling podcast.scraped for Job ID: ${jobId} - Starting content generation (DeepDive: ${deepDiveOption}).`,
    );

    try {
      // Prepare LLM Prompts
      const summaryPrompt = `Generate a concise summary for the following article titled "${title}". Focus on the key takeaways. Output should be JSON matching the provided schema.

Article Text:
${bodyText.substring(0, 8000)}`; // Limit text length if needed

      const dialoguePrompt = `Create a conversational dialogue transcript based on the article titled "${title}". Imagine two hosts discussing the main points. Make it engaging and follow the provided JSON schema.

Article Text:
${bodyText.substring(0, 8000)}`; // Limit text length

      // Invoke LLM Service (Parallel) with schema descriptions
      this.logger.log(
        `Job ID: ${jobId} - Calling LLM for summary and dialogue with schema descriptions.`,
      );
      const [summaryResult, dialogueResult] = await Promise.all([
        this.llmService.generateJsonResponse<Summary>(summaryPrompt, {
          // Provide the schema description for Summary
          jsonSchemaDescription: summarySchemaDescription,
          // Add other options like modelOverride, temperature if needed
        }),
        this.llmService.generateJsonResponse<Dialogue>(dialoguePrompt, {
          // Provide the schema description for Dialogue
          jsonSchemaDescription: dialogueSchemaDescription,
          // Add other options like modelOverride, temperature if needed
        }),
      ]);
      this.logger.log(
        `Job ID: ${jobId} - LLM generation successful. Summary title: ${summaryResult?.title?.substring(0, 50)}...`,
      );

      // Handle Success
      // Basic validation (adjust as needed)
      if (
        !summaryResult?.title ||
        !summaryResult?.summaryPoints ||
        !Array.isArray(summaryResult.summaryPoints) ||
        !dialogueResult?.title ||
        !dialogueResult?.segments ||
        !Array.isArray(dialogueResult.segments)
      ) {
        this.logger.error(
          `Job ID: ${jobId} - Invalid structure in LLM response.`,
          { summaryResult, dialogueResult },
        );
        throw new Error('Invalid LLM response structure'); // Will be caught below
      }

      // Persist Results
      await this.db
        .update(schema.podcasts)
        .set({
          summary: summaryResult, // Assuming 'summary' is the JSONB column
          transcript: dialogueResult, // Assuming 'transcript' is the JSONB column
          status: 'GENERATING_AUDIO',
          updatedAt: new Date(),
        })
        .where(eq(schema.podcasts.id, jobId));
      this.logger.log(
        `Job ID: ${jobId} - Persisted summary and transcript. Status set to GENERATING_AUDIO.`,
      );

      // Emit Next Event
      const nextPayload: PodcastContentGeneratedPayload = {
        jobId,
        dialogue: dialogueResult, // Send the full dialogue for TTS
        userId,
      };
      this.eventEmitter.emit('podcast.content_generated', nextPayload);
      this.logger.log(
        `Job ID: ${jobId} - Emitted podcast.content_generated event.`,
      );
    } catch (error) {
      // Handle Failure
      let errorMessage = 'Unknown content generation error';
      let errorStack: string | undefined;

      if (error instanceof LlmError) {
        errorMessage = `LLM Error (${error.type}): ${error.message}`;
        errorStack = error.stack;
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      }

      this.logger.error(
        `Job ID: ${jobId} failed during GENERATING_CONTENT step. Error: ${errorMessage}`,
        errorStack,
      );

      await this.db
        .update(schema.podcasts)
        .set({
          status: 'FAILED',
          errorMessage: errorMessage,
          errorStep: 'GENERATING_CONTENT',
          updatedAt: new Date(),
        })
        .where(eq(schema.podcasts.id, jobId));

      // Optional: Emit failure event
      // this.eventEmitter.emit('podcast.failed', { jobId, errorStep: 'GENERATING_CONTENT', errorMessage });
    }
  }

  @OnEvent('podcast.content_generated', { async: true })
  async handleContentGenerated(
    payload: PodcastContentGeneratedPayload,
  ): Promise<void> {
    const { jobId, dialogue, userId } = payload;
    this.logger.log(
      `Handling podcast.content_generated for Job ID: ${jobId} - Triggering audio segment generation.`,
    );

    const segments = dialogue?.segments;

    // Validate segments
    if (!Array.isArray(segments) || segments.length === 0) {
      this.logger.error(
        `Job ID: ${jobId} - Invalid or missing/empty dialogue segments in payload.`,
      );
      try {
        await this.db
          .update(schema.podcasts)
          .set({
            status: 'FAILED',
            errorMessage: 'Dialogue segments missing or empty',
            errorStep: 'GENERATING_AUDIO',
            updatedAt: new Date(),
          })
          .where(eq(schema.podcasts.id, jobId));
        this.logger.log(
          `Job ID: ${jobId} - Marked job as FAILED due to missing segments.`,
        );
        // Optional: Emit podcast.failed event
      } catch (failError) {
        this.logger.error(
          `Job ID: ${jobId} - Failed to mark job as FAILED after segment validation error. DB Error: ${failError instanceof Error ? failError.message : String(failError)}`,
          failError instanceof Error ? failError.stack : undefined,
        );
      }
      return; // Stop processing
    }

    const totalSegments = segments.length;
    this.logger.log(
      `Job ID: ${jobId} - Found ${totalSegments} segments to process.`,
    );

    try {
      // Update Job Metadata in Database
      await this.db
        .update(schema.podcasts)
        .set({
          // Assuming jobMetadata is a JSONB column
          // WARNING: This overwrites existing metadata. Merge if needed.
          jobMetadata: { totalSegments: totalSegments },
          updatedAt: new Date(),
          // Status remains 'GENERATING_AUDIO'
        })
        .where(eq(schema.podcasts.id, jobId));
      this.logger.log(
        `Job ID: ${jobId} - Updated job metadata with total segment count: ${totalSegments}.`,
      );

      // Emit Events for Each Segment
      segments.forEach((segment: Segment, index: number) => {
        const segmentPayload: PodcastSegmentAudioRequestedPayload = {
          jobId,
          segmentIndex: index,
          segmentText: segment.text,
          segmentSpeaker: segment.speaker,
          totalSegments,
          userId, // Pass userId along
        };
        this.eventEmitter.emit(
          'podcast.segment.audio_requested',
          segmentPayload,
        );
      });

      this.logger.log(
        `Job ID: ${jobId} - Emitted ${totalSegments} 'podcast.segment.audio_requested' events.`,
      );
    } catch (dbError) {
      this.logger.error(
        `Job ID: ${jobId} - Failed to update job metadata or emit events. Error: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
        dbError instanceof Error ? dbError.stack : undefined,
      );
      // Fail the job if we can't store the segment count or encountered error during emission loop
      try {
        await this.db
          .update(schema.podcasts)
          .set({
            status: 'FAILED',
            errorMessage: 'Failed to prepare for audio generation',
            errorStep: 'GENERATING_AUDIO',
            updatedAt: new Date(),
          })
          .where(eq(schema.podcasts.id, jobId));
        this.logger.log(
          `Job ID: ${jobId} - Marked job as FAILED due to DB/event emission error.`,
        );
        // Optional: Emit podcast.failed event
      } catch (failError) {
        this.logger.error(
          `Job ID: ${jobId} - Failed to mark job as FAILED after DB/event error. DB Error: ${failError instanceof Error ? failError.message : String(failError)}`,
          failError instanceof Error ? failError.stack : undefined,
        );
      }
      return; // Stop processing if DB update fails
    }
  }

  @OnEvent('podcast.segment.audio_requested', { async: true })
  async handleSegmentAudioRequested(
    payload: PodcastSegmentAudioRequestedPayload,
  ): Promise<void> {
    const { jobId, segmentIndex, segmentText, segmentSpeaker, totalSegments } =
      payload;
    const logPrefix = `Job ID: ${jobId}, Segment: ${segmentIndex + 1}/${totalSegments}`; // Reusable log prefix

    this.logger.log(`${logPrefix} - Handling podcast.segment.audio_requested.`);

    const tempDir = path.join(BASE_TEMP_DIR, String(jobId));
    const tempFilePath = path.join(tempDir, `${segmentIndex}.mp3`);

    try {
      // Invoke TTS Service
      this.logger.log(`${logPrefix} - Generating TTS audio.`);
      // TODO: Add proper voice mapping based on segmentSpeaker
      const audioBuffer: Buffer = await this.ttsService.generateSpeech(
        segmentText,
        {
          // Example: Simple mapping, refine as needed
          voice: segmentSpeaker?.toLowerCase().includes('host 1')
            ? 'Ash'
            : 'Jenny',
          // voice: segmentSpeaker as 'Ash' | 'Jenny', // Original Cast - might need adjustment
          // Add other TtsGenerationOptions if needed (languageCode, speed)
        },
      );
      this.logger.log(
        `${logPrefix} - TTS generation successful (${audioBuffer.length} bytes).`,
      );

      // Store Audio Buffer Temporarily (Filesystem)
      this.logger.log(`${logPrefix} - Ensuring directory exists: ${tempDir}`);
      // Ensure directory exists (implement robustly)
      await fs.mkdir(tempDir, { recursive: true }); // Creates parent dirs if needed

      this.logger.log(
        `${logPrefix} - Writing audio buffer to: ${tempFilePath}`,
      );
      await fs.writeFile(tempFilePath, audioBuffer);
      this.logger.log(`${logPrefix} - Audio buffer stored temporarily.`);

      // Handle Success (Emit Completion Event)
      const nextPayload: PodcastSegmentAudioGeneratedPayload = {
        jobId,
        segmentIndex,
        totalSegments,
        // Forward userId if available in payload, otherwise SegmentAudioGenerated handles fetching it
        // userId: payload.userId, // Removed - userId not part of this DTO
      };
      this.eventEmitter.emit('podcast.segment.audio_generated', nextPayload);
      this.logger.log(
        `${logPrefix} - Emitted podcast.segment.audio_generated event.`,
      );
    } catch (error) {
      // Handle Failure
      let errorMessage = `Unknown error during audio generation for segment ${segmentIndex + 1}`;
      let errorStack: string | undefined;

      if (error instanceof TtsError) {
        // Adjusted error message - removed error.type check
        errorMessage = `TTS Error at segment ${segmentIndex + 1}: ${error.message}`;
        errorStack = error.stack;
      } else if (error instanceof Error) {
        errorMessage = `Failed at segment ${segmentIndex + 1}: ${error.message}`;
        errorStack = error.stack;
      }

      this.logger.error(
        `${logPrefix} - Failed during GENERATING_AUDIO step. Error: ${errorMessage}`,
        errorStack,
      );

      try {
        await this.db
          .update(schema.podcasts)
          .set({
            status: 'FAILED',
            errorMessage: errorMessage,
            errorStep: 'GENERATING_AUDIO',
            updatedAt: new Date(),
          })
          .where(eq(schema.podcasts.id, jobId));
        this.logger.warn(
          `${logPrefix} - Job ID: ${jobId} marked as FAILED due to error in this segment.`,
        );
      } catch (dbError) {
        this.logger.error(
          `Job ID: ${jobId} - CRITICAL: Failed to update job status to FAILED after audio generation error for segment ${segmentIndex + 1}. DB Error: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
          dbError instanceof Error ? dbError.stack : undefined,
        );
      }

      // Optional: Emit failure event
      // this.eventEmitter.emit('podcast.failed', { jobId, errorStep: 'GENERATING_AUDIO', errorMessage });
    }
  }

  @OnEvent('podcast.segment.audio_generated', { async: true })
  async handleSegmentAudioGenerated(
    payload: PodcastSegmentAudioGeneratedPayload,
  ): Promise<void> {
    const { jobId, segmentIndex, totalSegments } = payload;
    const logPrefix = `Job ID: ${jobId}, Seg ${segmentIndex + 1}/${totalSegments}`;

    this.logger.log(
      `${logPrefix} - Received podcast.segment.audio_generated event.`,
    );

    // Update Completion Count
    // TODO: Needs locking/atomic updates for robust concurrency
    let currentState = jobCompletionTracker.get(jobId);
    if (!currentState) {
      // Fetch userId if not passed through or if this is the first segment handled by this instance
      // const userId = payload.userId ?? await this.getUserIdForJob(jobId);
      // Rely solely on getUserIdForJob as payload doesn't contain userId
      const userId = await this.getUserIdForJob(jobId);
      currentState = {
        completedCount: 0,
        totalSegments: totalSegments,
        userId: userId, // Store userId
      };
    }
    currentState.completedCount += 1;
    jobCompletionTracker.set(jobId, currentState);
    this.logger.log(
      `${logPrefix} - Completed count for Job ${jobId}: ${currentState.completedCount}/${currentState.totalSegments}`,
    );

    // Check if Job is Complete
    if (currentState.completedCount !== currentState.totalSegments) {
      this.logger.log(
        `${logPrefix} - Job ${jobId} not yet complete. Waiting...`,
      );
      return; // Not done yet
    }

    // All Segments Generated - Process Concatenation
    this.logger.log(
      `${logPrefix} - All segments generated for Job ${jobId}. Starting final processing.`,
    );

    const finalUserId = currentState.userId; // Get stored userId
    jobCompletionTracker.delete(jobId); // Clear tracker for this job

    const tempDir = path.join(BASE_TEMP_DIR, String(jobId));

    try {
      // 1. Read all segment audio buffers
      const segmentBuffers: Buffer[] = [];
      this.logger.log(
        `${logPrefix} - Reading segment files from ${tempDir}...`,
      );
      for (let i = 0; i < totalSegments; i++) {
        const segmentPath = path.join(tempDir, `${i}.mp3`);
        try {
          const buffer = await fs.readFile(segmentPath);
          segmentBuffers.push(buffer);
          this.logger.log(`${logPrefix} - Read segment file: ${segmentPath}`);
        } catch (readError) {
          this.logger.error(
            `${logPrefix} - Failed to read segment file ${segmentPath}. Aborting.`,
            readError,
          );
          throw new Error(`Failed to read required segment file: ${i}.mp3`);
        }
      }

      // 2. Concatenate segments using AudioService
      this.logger.log(
        `${logPrefix} - Calling audioService.stitchAudioSegments.`,
      );
      const finalAudioBuffer =
        await this.audioService.stitchAudioSegments(segmentBuffers);
      this.logger.log(
        `${logPrefix} - Audio concatenation successful (${finalAudioBuffer.length} bytes).`,
      );

      // 3. Save final audio buffer to Database using AudioService
      this.logger.log(`${logPrefix} - Saving final audio buffer to database.`);
      await this.audioService.saveAudioToDatabase(jobId, finalAudioBuffer);

      // 4. Update database status to COMPLETED
      this.logger.log(`${logPrefix} - Updating job status to COMPLETED.`);
      await this.db
        .update(schema.podcasts)
        .set({
          status: 'COMPLETED',
          updatedAt: new Date(),
          errorMessage: null,
          errorStep: null,
        })
        .where(eq(schema.podcasts.id, jobId));

      // 5. Emit completion event
      if (finalUserId === undefined) {
        this.logger.error(
          `${logPrefix} - Could not determine userId for completion event!`,
        );
        // Decide how to handle this - fail job? Emit without userId? For now, fallback.
      }
      const completionPayload: PodcastCompletedPayload = {
        jobId,
        userId: finalUserId ?? -1, // Use fetched userId, provide fallback or handle error
      };
      this.eventEmitter.emit('podcast.completed', completionPayload);
      this.logger.log(`${logPrefix} - Emitted podcast.completed event.`);

      // 6. Clean up temporary segment directory
      this.logger.log(
        `${logPrefix} - Cleaning up temporary directory: ${tempDir}`,
      );
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        this.logger.log(
          `${logPrefix} - Successfully removed temporary directory: ${tempDir}`,
        );
      } catch (cleanupError) {
        this.logger.warn(
          `${logPrefix} - Failed to clean up temporary directory ${tempDir}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    } catch (error) {
      // Handle Failure during Concatenation/Finalization
      let errorMessage = 'Unknown finalization error';
      let errorStack: string | undefined;
      if (error instanceof Error) {
        errorMessage = `Finalization failed: ${error.message}`;
        errorStack = error.stack;
      }

      this.logger.error(
        `${logPrefix} - Failed during finalization step. Error: ${errorMessage}`,
        errorStack,
      );
      try {
        await this.db
          .update(schema.podcasts)
          .set({
            status: 'FAILED',
            errorMessage: errorMessage,
            errorStep: 'COMPLETING', // Or 'SAVING_AUDIO', 'FINALIZING'
            updatedAt: new Date(),
          })
          .where(eq(schema.podcasts.id, jobId));
        this.logger.warn(
          `${logPrefix} - Job marked as FAILED during finalization step.`,
        );
      } catch (dbError) {
        this.logger.error(
          `Job ID: ${jobId} - CRITICAL: Failed to update job status to FAILED after finalization error. DB Error: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
          dbError instanceof Error ? dbError.stack : undefined,
        );
      }
      // Attempt cleanup even on failure
      this.logger.log(
        `${logPrefix} - Attempting cleanup of temporary directory after failure: ${tempDir}`,
      );
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn(
          `${logPrefix} - Failed to clean up temporary directory ${tempDir} after failure: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }
  }

  /**
   * Retrieves the status and details of a specific podcast job.
   *
   * @param jobId The ID of the job to retrieve.
   * @returns A DTO containing the job details, or null if not found.
   * @throws Error if the database query fails.
   */
  async getPodcastJobStatus(
    jobId: number,
  ): Promise<PodcastJobStatusDto | null> {
    this.logger.log(`Fetching status for job ID: ${jobId}`);
    try {
      const result = await this.db
        .select({
          jobId: schema.podcasts.id,
          status: schema.podcasts.status,
          url: schema.podcasts.url,
          title: schema.podcasts.title,
          createdAt: schema.podcasts.createdAt,
          updatedAt: schema.podcasts.updatedAt,
          errorMessage: schema.podcasts.errorMessage,
          errorStep: schema.podcasts.errorStep,
        })
        .from(schema.podcasts)
        .where(eq(schema.podcasts.id, jobId))
        .limit(1);

      if (result.length === 0) {
        this.logger.warn(`Job ID: ${jobId} not found.`);
        return null;
      }

      this.logger.log(
        `Found job ID: ${jobId} with status: ${result[0].status}`,
      );
      return result[0];
    } catch (error) {
      this.logger.error(
        `Failed to fetch status for job ID ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Re-throw or handle as appropriate for API response (e.g., return 500)
      throw error;
    }
  }
}
