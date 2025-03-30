/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  HttpStatus,
} from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';

// Define DTO for Login response
class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOi...' })
  access_token: string;
}

// Define DTO for Profile response
class ProfileResponseDto {
  @ApiProperty({ example: 1 })
  userId: number;
  @ApiProperty({ example: 'user@example.com' })
  email: string;
}

// Define DTO for Login request body (for Swagger)
class LoginRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;
  @ApiProperty({ example: 'password123' })
  password: string;
}

// Define an interface for the user object attached by Passport
interface AuthenticatedUser {
  id: number;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define an interface for the user object attached by JWT strategy
interface JwtAuthenticatedUser {
  userId: number;
  email: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Log in a user' })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successful Login',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  login(@Request() req: ExpressRequest): LoginResponseDto {
    // req.user is populated by LocalStrategy after successful validation
    // We pass this user object (without password hash) to the login service method
    return this.authService.login(req.user as AuthenticatedUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile data',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  getProfile(@Request() req: ExpressRequest): ProfileResponseDto {
    // req.user is populated by JwtStrategy.validate
    return req.user as JwtAuthenticatedUser; // Return the user info from the JWT payload
  }
}
