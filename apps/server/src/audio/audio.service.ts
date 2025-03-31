import { Inject, Injectable, Logger } from '@nestjs/common';
import { PG_CONNECTION } from '../db/drizzle.constants';
import * as schema from '../db/schema'; // Import the whole schema
import { NodePgDatabase } from 'drizzle-orm/node-postgres'; // Import the DB type
import { eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config'; // Keep ConfigService

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    @Inject(PG_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Stitches multiple MP3 audio segments together into a single MP3 file **in memory**.
   *
   * **WARNING:** Simple buffer concatenation for MP3s is often unreliable and can
   * result in corrupted files, especially if segments have different properties
   * (bitrate, sample rate) or contain metadata (ID3 tags). Use with caution
   * and test thoroughly. The ffmpeg-based approach is generally more robust.
   *
   * @param audioSegments An array of Buffers, each containing MP3 audio data, in the desired order.
   * @returns A Buffer containing the combined MP3 audio data.
   * @throws Error if no segments are provided or if concatenation fails.
   */
  stitchAudioSegments(audioSegments: Buffer[]): Buffer {
    if (!audioSegments || audioSegments.length === 0) {
      this.logger.error('No audio segments provided for stitching.');
      throw new Error('No audio segments provided for stitching.');
    }

    if (audioSegments.length === 1) {
      this.logger.log(
        'Only one segment provided, returning it directly (in-memory).',
      );
      return audioSegments[0];
    }

    this.logger.log(
      `Attempting to stitch ${audioSegments.length} audio segments in memory using Buffer.concat.`,
    );
    this.logger.warn(
      'Using simple Buffer.concat for MP3 stitching. This may lead to corrupted files. Consider using the ffmpeg approach for reliability.',
    );

    try {
      // --- In-Memory Concatenation ---
      // This simply joins the byte arrays. It does not intelligently handle
      // MP3 frame headers, metadata (ID3 tags), VBR headers, etc.
      const combinedBuffer = Buffer.concat(audioSegments);
      // -----------------------------

      this.logger.log(
        `Successfully concatenated ${audioSegments.length} segments in memory. Resulting buffer size: ${combinedBuffer.length} bytes.`,
      );
      return combinedBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error during in-memory audio stitching: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`In-memory stitching failed: ${errorMessage}`);
    }
  }

  /**
   * Saves the provided audio buffer to the database for a specific podcast.
   * @param podcastId The ID of the podcast to update.
   * @param audioBuffer The Buffer containing the audio data.
   * @throws Error if the database update fails.
   */
  async saveAudioToDatabase(
    podcastId: number,
    audioBuffer: Buffer,
  ): Promise<void> {
    this.logger.log(
      `Attempting to save audio data to database for podcast ID: ${podcastId}`,
    );
    try {
      const result = await this.db
        .update(schema.podcasts)
        .set({
          audioData: audioBuffer,
          updatedAt: new Date(),
        })
        .where(eq(schema.podcasts.id, podcastId))
        .returning({ updatedId: schema.podcasts.id });

      if (result.length === 0) {
        throw new Error(
          `Podcast with ID ${podcastId} not found for updating audio.`,
        );
      }

      this.logger.log(
        `Successfully saved audio data for podcast ID: ${result[0].updatedId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(
        `Failed to save audio data for podcast ID ${podcastId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Database error while saving audio: ${errorMessage}`);
    }
  }
}
