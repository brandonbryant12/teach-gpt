import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { TtsService } from '../../tts/tts.service';
import {
  PodcastSegmentAudioRequestedPayload,
  PodcastSegmentAudioGeneratedPayload,
  PodcastStatus,
} from '../interfaces/podcast.interface';
import { PodcastJobHelperService } from '../podcast-job-helper.service';

@Injectable()
export class SegmentAudioRequestedListener {
  private readonly logger = new Logger(SegmentAudioRequestedListener.name);

  constructor(
    private readonly ttsService: TtsService,
    private readonly jobHelper: PodcastJobHelperService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('podcast.segment.audio_requested', { async: true })
  async handleSegmentAudioRequested(
    payload: PodcastSegmentAudioRequestedPayload,
  ): Promise<void> {
    const { jobId, segmentIndex, segmentText, segmentSpeaker, totalSegments } =
      payload;
    // Note: We use GENERATING_AUDIO as the "current step" for failure reporting,
    // even though individual segments are processed.
    const currentStep: PodcastStatus = 'GENERATING_AUDIO';
    this.logger.log(
      `Handling segment ${segmentIndex + 1}/${totalSegments} audio request for Job ID: ${jobId}`,
    );

    try {
      // TODO: Add logic to select voice based on segmentSpeaker if needed
      const audioBuffer = await this.ttsService.generateSpeech(segmentText);
      this.logger.log(
        `Generated audio buffer for segment ${segmentIndex + 1} of Job ID: ${jobId}`,
      );

      // Store buffer and check if job is complete using helper
      const allSegmentsComplete = this.jobHelper.storeSegmentAudio(
        jobId,
        segmentIndex,
        audioBuffer,
      );

      // Emit success event for this segment
      const segmentGeneratedPayload: PodcastSegmentAudioGeneratedPayload = {
        jobId,
        segmentIndex,
        totalSegments,
        // buffer not needed in payload if stored centrally
      };
      this.eventEmitter.emit(
        'podcast.segment.audio_generated',
        segmentGeneratedPayload,
      );

      // Check completion status *after* emitting segment generated event
      if (allSegmentsComplete) {
        this.logger.log(
          `All ${totalSegments} audio segments generated for Job ID: ${jobId}. Emitting all_audio_generated.`,
        );
        // Use the helper method to get userId
        const userId = await this.jobHelper.getJobUserId(jobId);
        if (userId === null) {
          // If userId is null, the job likely failed or was deleted. Avoid emitting.
          this.logger.error(
            `Could not retrieve userId for completed Job ID: ${jobId}. Cannot emit all_audio_generated.`,
          );
          return;
        }
        this.eventEmitter.emit('podcast.all_audio_generated', {
          jobId,
          userId,
        });
      }
    } catch (error) {
      await this.jobHelper.failJob(
        jobId,
        currentStep,
        `TTS generation failed for segment ${segmentIndex}: ${error.message}`,
        error,
      );
    }
  }
}
