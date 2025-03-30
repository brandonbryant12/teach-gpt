import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Request as NestRequest,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PodcastService } from './podcast.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  PodcastRequestResponseDto,
  PodcastStatusResponseDto,
  RequestPodcastCreationDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Define an interface for the Request object augmented by JwtStrategy
interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('Podcasts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('podcasts')
export class PodcastController {
  private readonly logger = new Logger(PodcastController.name);

  constructor(private readonly podcastService: PodcastService) {}

  @Post()
  @ApiOperation({
    summary: 'Request Podcast Creation',
    description:
      'Submits a URL to initiate the asynchronous process of generating a podcast. Returns a job ID to track progress.',
  })
  @ApiResponse({
    status: 201, // Created
    description: 'Podcast creation job successfully requested.',
    type: PodcastRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body (URL or options).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async requestPodcastCreation(
    @Body() requestPodcastDto: RequestPodcastCreationDto,
    @NestRequest() req: RequestWithUser,
  ): Promise<PodcastRequestResponseDto> {
    const userId = req.user.userId;

    this.logger.log(
      `User ${userId} requesting podcast for URL: ${requestPodcastDto.url}`,
    );

    const result = await this.podcastService.requestPodcastCreation(
      requestPodcastDto.url,
      userId,
      { deepDiveOption: requestPodcastDto.deepDiveOption },
    );

    return result;
  }

  @Get(':jobId/status')
  @ApiOperation({
    summary: 'Get Podcast Job Status',
    description:
      'Retrieves the current status and results (if completed or failed) of a specific podcast generation job.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The ID of the podcast job',
    type: Number,
  })
  @ApiResponse({
    status: 200, // OK
    description: 'Current status and details of the podcast job.',
    type: PodcastStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Job not found or access denied.' })
  async getPodcastJobStatus(
    @Param('jobId', ParseIntPipe) jobId: number,
    @NestRequest() req: RequestWithUser,
  ): Promise<PodcastStatusResponseDto> {
    const userId = req.user.userId;

    this.logger.log(`User ${userId} requesting status for Job ID: ${jobId}`);

    return this.podcastService.getPodcastJobStatus(jobId, userId);
  }
}
