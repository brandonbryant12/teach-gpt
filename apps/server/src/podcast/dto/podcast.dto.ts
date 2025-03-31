import { ApiProperty } from '@nestjs/swagger';
import * as schema from '../../db/schema';
import { IsUrl, IsEnum } from 'class-validator';

// Infer the type from the enum defined in the schema
export type PodcastStatus =
  (typeof schema.podcastStatusEnum.enumValues)[number];
export type DeepDiveOptionType =
  (typeof schema.deepDiveOptionEnum.enumValues)[number];

export class PodcastRequestResponseDto {
  @ApiProperty({
    example: 123,
    description: 'The unique ID for the podcast generation job',
  })
  jobId: number;

  @ApiProperty({
    example: 'PENDING',
    enum: schema.podcastStatusEnum.enumValues,
    description: 'The initial status of the job',
  })
  status: PodcastStatus;
}

// DTO for the controller's input validation
export class CreatePodcastRequestDto {
  @ApiProperty({
    example: 'https://example.com/article',
    description: 'URL of the article to summarize',
  })
  @IsUrl()
  url: string;

  @ApiProperty({
    enum: schema.deepDiveOptionEnum.enumValues,
    example: 'RETAIN',
    description: 'Content generation strategy',
  })
  @IsEnum(schema.deepDiveOptionEnum.enumValues)
  deepDiveOption: DeepDiveOptionType;
}

// Interface for the event payload emitted when a podcast request is created
export interface PodcastRequestedPayload {
  jobId: number;
  url: string;
  userId: number;
  deepDiveOption: DeepDiveOptionType;
}

// Interface for the event payload emitted after successful scraping
export interface PodcastScrapedPayload {
  jobId: number;
  title: string;
  bodyText: string;
  userId: number;
  deepDiveOption: DeepDiveOptionType;
}

// Basic structure for Summary (stored as JSONB)
export interface Summary {
  title: string;
  summaryPoints: string[]; // Or a single string, adjust as needed
}

// Renamed from DialogueSegment, changed line -> text
export interface Segment {
  speaker: string; // e.g., 'Host', 'Guest'
  text: string;
}

// Basic structure for Dialogue (stored as JSONB)
export interface Dialogue {
  title: string;
  segments: Segment[]; // Use the renamed interface
}

// Payload for when content generation is complete
export interface PodcastContentGeneratedPayload {
  jobId: number;
  dialogue: Dialogue;
  userId: number;
}

// Payload for requesting audio generation for a single segment
export interface PodcastSegmentAudioRequestedPayload {
  jobId: number;
  segmentIndex: number;
  segmentText: string;
  segmentSpeaker: string; // "Ash" or "Jenny"
  totalSegments: number;
  userId: number; // Pass userId along if needed by TTS or later steps
}

// Payload indicating a single segment's audio has been generated and stored
export interface PodcastSegmentAudioGeneratedPayload {
  jobId: number;
  segmentIndex: number;
  totalSegments: number;
}

// Payload indicating the final podcast audio has been successfully generated
export interface PodcastCompletedPayload {
  jobId: number;
  userId: number;
}

// DTO for returning the status and details of a specific job
export class PodcastJobStatusDto {
  @ApiProperty({ example: 123, description: 'The unique ID for the job' })
  jobId: number;

  @ApiProperty({
    enum: schema.podcastStatusEnum.enumValues,
    description: 'The current status of the job',
  })
  status: PodcastStatus;

  @ApiProperty({
    example: 'https://example.com/article',
    description: 'The source URL for the podcast',
  })
  url: string;

  @ApiProperty({
    example: 'Podcast Title From LLM',
    description: 'Title of the generated podcast (if available)',
    required: false,
  })
  title?: string | null;

  @ApiProperty({ description: 'Timestamp when the job was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the job was last updated' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Error message if the job failed',
    required: false,
  })
  errorMessage?: string | null;

  @ApiProperty({
    description: 'The step where the error occurred',
    required: false,
  })
  errorStep?: string | null;

  // NOTE: We are NOT including the raw audioData buffer here for performance.
  // A separate endpoint would be needed to stream/download the audio if stored in DB.
}
