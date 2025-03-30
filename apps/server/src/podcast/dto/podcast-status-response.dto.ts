import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PodcastStatus,
  PodcastApiResponse,
  DeepDiveOption,
} from '../interfaces/podcast.interface';
import { deepDiveOptionEnum, podcastStatusEnum } from '../../db/schema';

// This DTO represents the structure of the final podcast data when the job is COMPLETED.
// It's used as a nested object within PodcastStatusResponseDto.
class PodcastResultDto implements Partial<PodcastApiResponse> {
  @ApiProperty({ example: 123 })
  id: number;

  @ApiProperty({
    example: 42,
    description: 'The numeric ID of the user who requested the job',
  })
  userId: number;

  @ApiProperty({ example: 'https://example.com/news/article123' })
  url: string;

  @ApiProperty({ enum: deepDiveOptionEnum.enumValues, example: 'RETAIN' })
  deepDiveOption: DeepDiveOption;

  @ApiProperty({ enum: podcastStatusEnum.enumValues, example: 'COMPLETED' })
  status: PodcastStatus;

  @ApiProperty({ example: '2023-10-27T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-10-27T10:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: 'Understanding Quantum Computing' })
  title?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { keyPoints: ['...'], summaryText: '...' },
  })
  summary?: Record<string, any> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { segments: [{ speaker: 'A', text: '...' }] },
  })
  transcript?: Record<string, any> | null;

  @ApiPropertyOptional({
    example: 'https://storage.googleapis.com/podcasts/output.mp3',
  })
  audioUrl?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { segmentCount: 15 },
  })
  jobMetadata?: Record<string, any> | null;
}

export class PodcastStatusResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the podcast job being queried',
    example: 123,
  })
  jobId: number;

  @ApiProperty({
    description: 'The current status of the podcast job',
    enum: podcastStatusEnum.enumValues,
    example: 'GENERATING_AUDIO',
  })
  status: PodcastStatus;

  @ApiPropertyOptional({
    description: 'An error message if the job failed',
    example: 'Failed to scrape the provided URL.',
  })
  errorMessage?: string | null;

  @ApiPropertyOptional({
    description: 'The step (status) at which the job failed',
    enum: podcastStatusEnum.enumValues,
    example: 'SCRAPING',
  })
  errorStep?: PodcastStatus | null;

  @ApiPropertyOptional({
    description:
      "The final podcast data, only present if the status is 'COMPLETED'",
    type: PodcastResultDto, // Use the nested DTO
  })
  result?: PodcastResultDto | null;

  @ApiProperty({
    description: 'The timestamp when the job was initially created',
    example: '2023-10-27T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The timestamp when the job status was last updated',
    example: '2023-10-27T10:15:00.000Z',
  })
  updatedAt: Date;
}
