import { ApiProperty } from '@nestjs/swagger';
import { PodcastStatus } from '../interfaces/podcast.interface';
import { podcastStatusEnum } from '../../db/schema';

export class PodcastRequestResponseDto {
  @ApiProperty({
    description: 'The unique identifier for the newly created podcast job',
    example: 123,
  })
  jobId: number;

  @ApiProperty({
    description: 'The initial status of the podcast job',
    enum: podcastStatusEnum.enumValues,
    example: 'PENDING',
  })
  status: PodcastStatus;
}
