import { Inject, Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { PG_CONNECTION } from '../db/drizzle.constants';
import * as schema from '../db/schema'; // Import the whole schema
import { NodePgDatabase } from 'drizzle-orm/node-postgres'; // Import the DB type
import { eq } from 'drizzle-orm';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    @Inject(PG_CONNECTION) private db: NodePgDatabase<typeof schema>, // Use imported schema type
  ) {}

  /**
   * Stitches multiple MP3 audio segments together into a single MP3 file.
   * @param audioSegments An array of Buffers, each containing MP3 audio data, in the desired order.
   * @returns A Promise resolving to a Buffer containing the combined MP3 audio data.
   * @throws Error if stitching fails.
   */
  async stitchAudioSegments(audioSegments: Buffer[]): Promise<Buffer> {
    if (!audioSegments || audioSegments.length === 0) {
      throw new Error('No audio segments provided for stitching.');
    }

    if (audioSegments.length === 1) {
      this.logger.log('Only one segment provided, returning it directly.');
      return audioSegments[0];
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-stitch-'));
    const tempFilePaths: string[] = [];
    const listFilePath = path.join(tempDir, 'mylist.txt');
    const outputFilePath = path.join(tempDir, `output-${uuidv4()}.mp3`);
    let fileContent = '';

    this.logger.log(`Created temporary directory: ${tempDir}`);

    try {
      // 1. Write segments to temporary files and create the list file content
      for (let i = 0; i < audioSegments.length; i++) {
        const tempFilePath = path.join(tempDir, `segment-${i}.mp3`);
        await fs.writeFile(tempFilePath, audioSegments[i]);
        tempFilePaths.push(tempFilePath);
        fileContent += `file '${path.basename(tempFilePath)}'\n`; // Use relative paths for ffmpeg list
        this.logger.log(`Wrote segment ${i} to ${tempFilePath}`);
      }

      // 2. Write the list file for ffmpeg's concat demuxer
      await fs.writeFile(listFilePath, fileContent);
      this.logger.log(`Created ffmpeg list file: ${listFilePath}`);

      // 3. Run ffmpeg to concatenate
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listFilePath)
          .inputOptions(['-f concat', '-safe 0']) // Use concat demuxer, -safe 0 allows relative paths in list
          .outputOptions(['-c copy']) // Copy codec, avoids re-encoding
          .output(outputFilePath)
          .on('start', (commandLine) => {
            this.logger.log('Spawned Ffmpeg with command: ' + commandLine);
          })
          .on('end', () => {
            this.logger.log('Ffmpeg processing finished.');
            resolve();
          })
          .on('error', (err) => {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Error during ffmpeg processing: ${errorMessage}`,
              err instanceof Error ? err.stack : undefined,
            );
            reject(new Error(`ffmpeg error: ${errorMessage}`));
          })
          .run();
      });

      // 4. Read the output file back into a buffer
      this.logger.log(`Reading stitched output file: ${outputFilePath}`);
      const outputBuffer = await fs.readFile(outputFilePath);

      return outputBuffer;
    } catch (error) {
      this.logger.error('Error during audio stitching process:', error);
      throw error; // Re-throw the error after logging
    } finally {
      // 5. Clean up temporary files and directory
      this.logger.log(`Cleaning up temporary directory: ${tempDir}`);
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        this.logger.log(`Successfully removed temporary directory: ${tempDir}`);
      } catch (cleanupError) {
        // Check if cleanupError is an Error object before logging
        const errorMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);
        const stack =
          cleanupError instanceof Error ? cleanupError.stack : undefined;

        this.logger.error(
          `Failed to clean up temporary directory ${tempDir}: ${errorMessage}`,
          stack, // Provide stack trace separately
        );
        // Log cleanup error but don't throw, as the main operation might have succeeded/failed already
      }
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
