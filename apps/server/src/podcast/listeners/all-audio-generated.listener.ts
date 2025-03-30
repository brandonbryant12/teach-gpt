import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import {
  PodcastAllAudioGeneratedPayload,
  PodcastCompletedPayload,
  PodcastStatus,
} from '..//interfaces/podcast.interface';
import { PodcastJobHelperService } from '../podcast-job-helper.service';
// TODO: Inject actual StorageService and AudioStitchingService

@Injectable()
export class AllAudioGeneratedListener {
  private readonly logger = new Logger(AllAudioGeneratedListener.name);

  constructor(
    private readonly jobHelper: PodcastJobHelperService,
    private readonly eventEmitter: EventEmitter2,
    // private readonly audioStitcher: AudioStitchingService, // Inject actual service
    // private readonly storageService: StorageService,    // Inject actual service
  ) {}

  @OnEvent('podcast.all_audio_generated', { async: true })
  async handleAllAudioGenerated(
    payload: PodcastAllAudioGeneratedPayload,
  ): Promise<void> {
    const { jobId, userId } = payload;
    const currentStep: PodcastStatus = 'STITCHING';
    this.logger.log(`Handling all_audio_generated for Job ID: ${jobId}`);

    try {
      await this.jobHelper.updateJobStatus(jobId, currentStep);

      const audioBuffers = this.jobHelper.retrieveJobAudioBuffers(jobId);
      this.logger.log(
        `Retrieved ${audioBuffers.length} buffers for stitching Job ID: ${jobId}`,
      );

      // --- Stitching Placeholder ---
      this.logger.log(`Starting audio stitching for Job ID: ${jobId}`);
      const finalAudioBuffer = Buffer.concat(audioBuffers);
      this.logger.log(`Finished audio stitching for Job ID: ${jobId}`);

      // --- Upload Placeholder ---
      const fileName = `podcast-${jobId}.mp3`;
      this.logger.log(
        `Uploading final audio (${fileName}) for Job ID: ${jobId}`,
      );
      const finalAudioUrl = `https://fake-storage.com/user-${userId}/${fileName}`;
      this.logger.log(`Final audio URL for Job ID: ${jobId}: ${finalAudioUrl}`);

      // Fetch the final record state using the helper method
      const finalRecord = await this.jobHelper.getJobRecord(jobId);
      if (!finalRecord) {
        throw new Error(
          `Job record ${jobId} disappeared before final completion.`,
        );
      }

      await this.jobHelper.updateJobStatus(jobId, 'COMPLETED', {
        audioUrl: finalAudioUrl,
      });

      const completedPayload: PodcastCompletedPayload = {
        jobId,
        finalPodcastRecord: {
          ...finalRecord,
          status: 'COMPLETED',
          audioUrl: finalAudioUrl,
          updatedAt: new Date(),
        },
      };
      this.eventEmitter.emit('podcast.completed', completedPayload);

      this.jobHelper.cleanupJobData(jobId);
    } catch (error) {
      await this.jobHelper.failJob(
        jobId,
        currentStep,
        `Audio stitching/upload failed: ${error.message}`,
        error,
      );
    }
  }
}
