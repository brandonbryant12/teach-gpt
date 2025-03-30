import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_CONNECTION } from '../db/drizzle.constants';
import * as schema from '../db/schema';
import {
  PodcastDbModel,
  PodcastFailedPayload,
  PodcastStatus,
} from './interfaces/podcast.interface';

// Temporary storage for audio segments (Consider a more robust solution for production)
interface TempAudioStorage {
  [jobId: number]: {
    [segmentIndex: number]: Buffer; // Store audio buffer in memory
    _completedSegments: Set<number>;
    _totalSegments?: number;
  };
}

@Injectable()
export class PodcastJobHelperService {
  private readonly logger = new Logger(PodcastJobHelperService.name);
  // TODO: Replace in-memory storage with a robust solution (Redis, DB, Temp Files)
  private tempAudioStorage: TempAudioStorage = {};

  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly eventEmitter: EventEmitter2, // Needed for emitting fail event
  ) {}

  /**
   * Initializes the temporary storage for a job's audio segments.
   */
  initializeJobStorage(jobId: number, totalSegments: number): void {
    this.logger.log(
      `Initializing temp storage for Job ID: ${jobId} with ${totalSegments} segments.`,
    );
    if (this.tempAudioStorage[jobId]) {
      this.logger.warn(
        `Storage for Job ID ${jobId} already exists. Overwriting.`,
      );
    }
    this.tempAudioStorage[jobId] = {
      _completedSegments: new Set(),
      _totalSegments: totalSegments,
    };
  }

  /**
   * Stores a generated audio segment buffer temporarily.
   * Returns true if all segments for the job are now complete, false otherwise.
   */
  storeSegmentAudio(
    jobId: number,
    segmentIndex: number,
    buffer: Buffer,
  ): boolean {
    const jobStorage = this.tempAudioStorage[jobId];
    if (!jobStorage) {
      // This might happen if the job failed or was cleaned up concurrently
      this.logger.warn(
        `Attempted to store segment ${segmentIndex} for Job ID ${jobId}, but storage not found.`,
      );
      return false;
    }

    if (jobStorage[segmentIndex]) {
      this.logger.warn(
        `Overwriting existing audio buffer for Job ID ${jobId}, Segment ${segmentIndex}`,
      );
    }

    jobStorage[segmentIndex] = buffer;
    jobStorage._completedSegments.add(segmentIndex);
    this.logger.log(
      `Stored audio for Job ID ${jobId}, Segment ${segmentIndex + 1}/${jobStorage._totalSegments}. Count: ${jobStorage._completedSegments.size}`,
    );

    return jobStorage._completedSegments.size === jobStorage._totalSegments;
  }

  /**
   * Retrieves all audio buffers for a completed job in order.
   * Throws an error if any segment is missing.
   */
  retrieveJobAudioBuffers(jobId: number): Buffer[] {
    const jobStorage = this.tempAudioStorage[jobId];
    if (!jobStorage) {
      throw new Error(
        `Temporary storage for Job ID ${jobId} not found during retrieval.`,
      );
    }

    const totalSegments = jobStorage._totalSegments ?? 0;
    if (jobStorage._completedSegments.size !== totalSegments) {
      throw new Error(
        `Attempting to retrieve buffers for incomplete Job ID ${jobId}. Expected ${totalSegments}, got ${jobStorage._completedSegments.size}.`,
      );
    }

    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < totalSegments; i++) {
      const buffer = jobStorage[i];
      if (!buffer) {
        this.logger.error(
          `Critical error: Missing audio buffer for segment ${i} of completed job ${jobId}.`,
        );
        throw new Error(
          `Missing audio buffer for segment ${i} of job ${jobId}`,
        );
      }
      audioBuffers.push(buffer);
    }
    this.logger.log(
      `Retrieved ${audioBuffers.length} audio buffers for Job ID ${jobId}`,
    );
    return audioBuffers;
  }

  /**
   * Retrieves the userId for a given job ID.
   * Returns null if the job is not found.
   */
  async getJobUserId(jobId: number): Promise<number | null> {
    try {
      const job = await this.db.query.podcasts.findFirst({
        columns: { userId: true },
        where: eq(schema.podcasts.id, jobId),
      });
      return job?.userId ?? null;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve userId for Job ID: ${jobId}`,
        error,
      );
      return null; // Return null on error to avoid blocking flow
    }
  }

  /**
   * Retrieves the full podcast job record from the database.
   * Returns null if not found.
   */
  async getJobRecord(jobId: number): Promise<PodcastDbModel | null> {
    try {
      const job = await this.db.query.podcasts.findFirst({
        where: eq(schema.podcasts.id, jobId),
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return job ?? null;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve record for Job ID: ${jobId}`,
        error,
      );
      return null;
    }
  }

  /**
   * Updates the status and optionally other data of a podcast job in the database.
   */
  async updateJobStatus(
    jobId: number,
    status: PodcastStatus,
    data: Partial<PodcastDbModel> = {},
  ): Promise<void> {
    this.logger.log(
      `Updating Job ID: ${jobId} to status: ${status} with data: ${JSON.stringify(
        data,
      )}`,
    );
    try {
      await this.db
        .update(schema.podcasts)
        .set({ status, ...data, updatedAt: new Date() })
        .where(eq(schema.podcasts.id, jobId));
    } catch (error) {
      this.logger.error(
        `Failed to update DB status for Job ID: ${jobId}`,
        error,
      );
      // Consider re-throwing or specific error handling
      throw error; // Re-throw to allow calling listener to handle/fail job
    }
  }

  /**
   * Marks a podcast job as FAILED in the database and emits a failure event.
   * Cleans up temporary data for the job.
   */
  async failJob(
    jobId: number,
    failedStep: PodcastStatus,
    errorMessage: string,
    originalError?: Error,
  ): Promise<void> {
    this.logger.error(
      `Failing Job ID: ${jobId} at step: ${failedStep}. Error: ${errorMessage}`,
      originalError?.stack,
    );
    try {
      // Update DB record to FAILED
      await this.db
        .update(schema.podcasts)
        .set({
          status: 'FAILED',
          errorStep: failedStep,
          errorMessage: errorMessage.substring(0, 1000), // Limit length
          updatedAt: new Date(),
        })
        .where(eq(schema.podcasts.id, jobId));

      // Emit a generic failure event
      const failurePayload: PodcastFailedPayload = {
        jobId,
        failedStep,
        errorMessage,
      };
      this.eventEmitter.emit('podcast.failed', failurePayload);
    } catch (dbError) {
      // Log the DB error, but the job is already considered failed.
      this.logger.error(
        `Failed to update job status to FAILED in DB for Job ID: ${jobId}`,
        dbError,
      );
    } finally {
      // Ensure cleanup happens even if DB update fails
      this.cleanupJobData(jobId);
    }
  }

  /**
   * Cleans up temporary data associated with a job.
   */
  cleanupJobData(jobId: number): void {
    if (this.tempAudioStorage[jobId]) {
      this.logger.log(`Cleaning up temporary data for Job ID: ${jobId}`);
      delete this.tempAudioStorage[jobId];
      // Add cleanup for temp files if using file-based storage
    }
  }
}
