import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PodcastSegmentAudioGeneratedPayload } from '../interfaces/podcast.interface';
// No other services needed for this simple version

@Injectable()
export class SegmentAudioGeneratedListener {
  private readonly logger = new Logger(SegmentAudioGeneratedListener.name);

  // No constructor dependencies needed for now

  @OnEvent('podcast.segment.audio_generated')
  handleSegmentAudioGenerated(
    payload: PodcastSegmentAudioGeneratedPayload,
  ): void {
    const { jobId, segmentIndex, totalSegments } = payload;
    // This listener now primarily serves for logging or triggering side effects
    // The completion check logic is handled in SegmentAudioRequestedListener
    this.logger.log(
      `Received notification: Segment ${segmentIndex + 1}/${totalSegments} audio generated for Job ID: ${jobId}`,
    );
    // Potential future use: Update progress indicator, etc.
  }
}
