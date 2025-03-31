import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards, // Now importing and using!
  Req,
  Logger,
  UnauthorizedException,
  Get,
  Param,
  ParseIntPipe,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express'; // Import Request from express
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth, // Now applying!
  ApiParam,
} from '@nestjs/swagger';
import { PodcastService } from './podcast.service';
import {
  CreatePodcastRequestDto,
  PodcastRequestResponseDto,
  PodcastJobStatusDto, // Import the status DTO
} from './dto/podcast.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Import the guard

// Define an interface for the Request object augmented by JwtStrategy
interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    // Add other properties from your JwtStrategy payload if needed
  };
}

@ApiTags('Podcasts')
@Controller('podcasts')
export class PodcastController {
  private readonly logger = new Logger(PodcastController.name);

  constructor(private readonly podcastService: PodcastService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard) // <-- Guard ensures req.user exists
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a new podcast generation job' })
  @ApiBody({ type: CreatePodcastRequestDto })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Podcast generation job accepted.',
    type: PodcastRequestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request body (e.g., invalid URL or options).',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized. Missing or invalid authentication token.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error during job creation.',
  })
  async createPodcast(
    @Body() createPodcastDto: CreatePodcastRequestDto,
    @Req() req: RequestWithUser, // req.user is guaranteed by JwtAuthGuard
  ): Promise<PodcastRequestResponseDto> {
    const userId = req.user.userId;
    this.logger.log(
      `User ID ${userId} requesting podcast for URL: ${createPodcastDto.url}`,
    );
    return this.podcastService.requestPodcastCreation(
      createPodcastDto.url,
      userId,
      { deepDiveOption: createPodcastDto.deepDiveOption },
    );
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get the status and details of a podcast job' })
  @ApiParam({
    name: 'jobId',
    description: 'The ID of the podcast job',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully.',
    type: PodcastJobStatusDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async getJobStatus(
    @Param('jobId', ParseIntPipe) jobId: number,
  ): Promise<PodcastJobStatusDto> {
    try {
      const jobStatus = await this.podcastService.getPodcastJobStatus(jobId);
      if (!jobStatus) {
        throw new NotFoundException(`Podcast job with ID ${jobId} not found.`);
      }
      return jobStatus;
    } catch (error) {
      // Handle known exceptions
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Log unexpected errors and throw a generic 500
      this.podcastService['logger'].error(
        // Access logger if private
        `Error fetching status for job ${jobId} in controller: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while fetching job status.',
      );
    }
  }

  // TODO: Add GET endpoint for checking job status
  // Example structure (also needs protection):
  // @Get(':jobId/status')
  // @UseGuards(JwtAuthGuard) // Secure the endpoint
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Get the status of a podcast generation job' })
  // ... other decorators ...
  // async getJobStatus(@Param('jobId', ParseIntPipe) jobId: number, @Req() req: RequestWithUser) {
  //   const userId = req.user.userId;
  //   // Add check for userId similar to createPodcast
  //   // Need to implement getPodcastJobStatus in PodcastService first
  //   // return this.podcastService.getPodcastJobStatus(jobId, userId);
  // }
}
