import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PodcastCompletedPayload,
  PodcastFailedPayload,
} from '../interfaces/podcast.interface';
import { PodcastJobHelperService } from '../podcast-job-helper.service';

@Injectable()
export class PodcastTerminalListener {
  private readonly logger = new Logger(PodcastTerminalListener.name);

  constructor(private readonly jobHelper: PodcastJobHelperService) {}

  @OnEvent('podcast.completed')
  handlePodcastCompleted(payload: PodcastCompletedPayload): void {
    this.logger.log(
      `Job ID: ${payload.jobId} successfully completed. Final URL: ${payload.finalPodcastRecord.audioUrl}`,
    );
    // Ensure cleanup is called on completion
    this.jobHelper.cleanupJobData(payload.jobId);
  }

  @OnEvent('podcast.failed')
  handlePodcastFailed(payload: PodcastFailedPayload): void {
    // Logging is already done within failJob in the helper service
    // This listener primarily ensures cleanup is called (which failJob also does),
    // but provides a hook for additional failure side-effects if needed.
    this.logger.error(
      `Received notification: Job ID: ${payload.jobId} failed at step ${payload.failedStep}. Error: ${payload.errorMessage}`,
    );
    // Cleanup is already handled by failJob, no need to call here unless logic changes.
    // this.jobHelper.cleanupJobData(payload.jobId);
  }
}
