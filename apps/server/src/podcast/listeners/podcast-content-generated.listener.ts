import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import {
  PodcastContentGeneratedPayload,
  PodcastSegmentAudioRequestedPayload,
  PodcastCompletedPayload,
  PodcastStatus,
} from '../interfaces/podcast.interface';
import { PodcastJobHelperService } from '../podcast-job-helper.service';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { Inject } from '@nestjs/common'; // Import Inject decorator
import { NodePgDatabase } from 'drizzle-orm/node-postgres'; // Import DB type

@Injectable()
export class PodcastContentGeneratedListener {
  private readonly logger = new Logger(PodcastContentGeneratedListener.name);

  constructor(
    private readonly jobHelper: PodcastJobHelperService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @OnEvent('podcast.content_generated', { async: true })
  async handlePodcastContentGenerated(
    payload: PodcastContentGeneratedPayload,
  ): Promise<void> {
    const { jobId, dialogue, userId } = payload;
    const currentStep: PodcastStatus = 'GENERATING_AUDIO';
    this.logger.log(`Handling podcast.content_generated for Job ID: ${jobId}`);

    try {
      const segments = dialogue?.segments ?? [];
      const totalSegments = segments.length;

      if (totalSegments === 0) {
        this.logger.warn(
          `Job ID: ${jobId} has no dialogue segments. Completing early.`,
        );
        // Need to fetch the final record state before emitting completion
        const finalRecord = await this.db.query.podcasts.findFirst({
          where: eq(schema.podcasts.id, jobId),
        });
        if (!finalRecord) {
          this.logger.error(
            `Job record ${jobId} not found during early completion.`,
          );
          // Avoid failing, just log and exit. The job might be cleaned up elsewhere.
          return;
        }
        // Update status but don't throw error from helper if it fails
        await this.jobHelper
          .updateJobStatus(jobId, 'COMPLETED', { audioUrl: null })
          .catch((err) => {
            this.logger.error(
              `Failed to update job ${jobId} status to COMPLETED during early exit`,
              err,
            );
          });
        const completedPayload: PodcastCompletedPayload = {
          jobId,
          finalPodcastRecord: {
            ...finalRecord,
            status: 'COMPLETED',
            audioUrl: null,
          },
        };
        this.eventEmitter.emit('podcast.completed', completedPayload);
        return;
      }

      // Update status and metadata via helper
      await this.jobHelper.updateJobStatus(jobId, currentStep, {
        jobMetadata: { segmentCount: totalSegments },
      });

      // Initialize temporary storage via helper
      this.jobHelper.initializeJobStorage(jobId, totalSegments);

      // Emit events for each segment
      segments.forEach((segment, index) => {
        const segmentPayload: PodcastSegmentAudioRequestedPayload = {
          jobId,
          segmentIndex: index,
          segmentText: segment.text,
          segmentSpeaker: segment.speaker,
          totalSegments,
          userId,
        };
        this.eventEmitter.emit(
          'podcast.segment.audio_requested',
          segmentPayload,
        );
      });
      this.logger.log(
        `Emitted ${totalSegments} segment audio requests for Job ID: ${jobId}`,
      );
    } catch (error) {
      // Use failJob which includes DB update and cleanup
      await this.jobHelper.failJob(
        jobId,
        currentStep,
        `Audio generation setup failed: ${error.message}`,
        error,
      );
    }
  }
}
