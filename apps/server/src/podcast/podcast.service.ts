/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { PG_CONNECTION } from '../db/drizzle.constants';
import * as schema from '../db/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  PodcastDbModel,
  PodcastStatus,
  PodcastRequestedPayload,
  DeepDiveOption,
} from './interfaces/podcast.interface';
import { PodcastRequestResponseDto } from './dto/podcast-request-response.dto';
import { PodcastStatusResponseDto } from './dto/podcast-status-response.dto';
@Injectable()
export class PodcastService {
  private readonly logger = new Logger(PodcastService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Initiates the podcast creation process for a given URL.
   * Creates a job record in the database and emits an event to start the workflow.
   * @param url The URL of the article to process.
   * @param userId Identifier for the user requesting the podcast.
   * @param options Configuration options for the podcast generation.
   * @returns A DTO containing the jobId and initial status ('PENDING').
   */
  async requestPodcastCreation(
    url: string,
    userId: number,
    options: { deepDiveOption: DeepDiveOption },
  ): Promise<PodcastRequestResponseDto> {
    this.logger.log(
      `Request received for URL: ${url} by user ID: ${userId} with options: ${JSON.stringify(
        options,
      )}`,
    );

    const initialStatus: PodcastStatus = 'PENDING';

    // 1. Create the initial job record in the database
    const newPodcastJob = await this.db
      .insert(schema.podcasts)
      .values({
        userId,
        url,
        deepDiveOption: options.deepDiveOption,
        status: initialStatus,
        // Other fields will be populated by listeners
      })
      .returning(); // Return the created record

    if (!newPodcastJob || newPodcastJob.length === 0) {
      this.logger.error('Failed to insert podcast job record into database.');
      // Consider throwing a specific internal server error here
      throw new Error('Database insertion failed');
    }

    const job = newPodcastJob[0];
    const jobId = job.id;

    this.logger.log(`Podcast job created with ID: ${jobId}`);

    // 2. Emit the event to trigger the first step of the pipeline
    const eventPayload: PodcastRequestedPayload = {
      jobId,
      url,
      userId,
      deepDiveOption: options.deepDiveOption,
    };
    this.eventEmitter.emit('podcast.requested', eventPayload);
    this.logger.log(`Emitted event: podcast.requested for Job ID: ${jobId}`);

    // 3. Return the initial response to the client
    return {
      jobId,
      status: initialStatus,
    };
  }

  /**
   * Retrieves the current status and details of a specific podcast job.
   * @param jobId The ID of the job to query.
   * @param userId The ID of the user making the request (for authorization).
   * @returns A DTO containing the job status, error info (if any), and final result (if completed).
   * @throws NotFoundException if the job doesn't exist or doesn't belong to the user.
   */
  async getPodcastJobStatus(
    jobId: number,
    userId: number,
  ): Promise<PodcastStatusResponseDto> {
    this.logger.log(
      `Fetching status for Job ID: ${jobId} for User ID: ${userId}`,
    );

    const job = await this.db.query.podcasts.findFirst({
      where: eq(schema.podcasts.id, jobId),
    });

    // Basic check: Job exists?
    if (!job) {
      this.logger.warn(`Job ID: ${jobId} not found.`);
      throw new NotFoundException(`Podcast job with ID ${jobId} not found.`);
    }

    // Authorization check: Compare numeric user IDs
    if (job.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access job ${jobId} owned by user ${job.userId}`,
      );
      throw new NotFoundException(`Podcast job with ID ${jobId} not found.`);
    }

    const response: PodcastStatusResponseDto = {
      jobId: job.id,
      status: job.status as PodcastStatus,
      errorMessage: job.errorMessage,
      errorStep: job.errorStep as PodcastStatus | null, // Cast errorStep to PodcastStatus
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: null, // Initialize result as null
    };

    // If completed, populate the result field
    if (job.status === 'COMPLETED') {
      // Map the DB model to the API response structure
      // We might want to exclude certain fields or transform data here
      // Using a simple spread for now, assuming PodcastApiResponse matches PodcastDbModel relevant fields
      response.result = {
        id: job.id,
        userId: job.userId,
        url: job.url,
        deepDiveOption: job.deepDiveOption,
        status: job.status as PodcastStatus,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        title: job.title,
        summary: job.summary as Record<string, any> | null,
        transcript: job.transcript as Record<string, any> | null,
        audioUrl: job.audioUrl,
        jobMetadata: job.jobMetadata as Record<string, any> | null,
      };
    }

    this.logger.log(
      `Returning status for Job ID: ${jobId}: ${response.status}`,
    );
    return response;
  }

  // --- Helper methods for listeners (can be moved to PodcastListeners) ---

  /**
   * Updates the status of a podcast job.
   * Should primarily be used by event listeners.
   */
  async updateJobStatus(
    jobId: number,
    status: PodcastStatus,
    data: Partial<PodcastDbModel> = {},
  ): Promise<void> {
    this.logger.log(`Updating Job ID: ${jobId} to status: ${status}`);
    try {
      await this.db
        .update(schema.podcasts)
        .set({ status, ...data, updatedAt: new Date() }) // Ensure updatedAt is updated
        .where(eq(schema.podcasts.id, jobId));
    } catch (error) {
      this.logger.error(`Failed to update status for Job ID: ${jobId}`, error);
      // Decide if we should re-throw or handle differently
    }
  }

  /**
   * Marks a podcast job as FAILED.
   * Should primarily be used by event listeners upon encountering an error.
   */
  async failJob(
    jobId: number,
    failedStep: PodcastStatus, // The status *before* it failed
    errorMessage: string,
  ): Promise<void> {
    this.logger.error(
      `Failing Job ID: ${jobId} at step: ${failedStep}. Error: ${errorMessage}`,
    );
    try {
      await this.db
        .update(schema.podcasts)
        .set({
          status: 'FAILED',
          errorStep: failedStep,
          errorMessage: errorMessage.substring(0, 1000), // Limit error message length
          updatedAt: new Date(),
        })
        .where(eq(schema.podcasts.id, jobId));

      // Emit a generic failure event (optional, but can be useful for monitoring)
      this.eventEmitter.emit('podcast.failed', {
        jobId,
        failedStep,
        errorMessage,
      });
    } catch (dbError) {
      this.logger.error(
        `Failed to update job status to FAILED for Job ID: ${jobId}`,
        dbError,
      );
    }
  }
}
