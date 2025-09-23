import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { User } from '../auth/entities/user.entity';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { StatusDto } from './dto/status.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Email Management')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('get-auth')
  @ApiOperation({
    summary: 'Get Google OAuth URL',
    description: 'Returns the Google OAuth URL for Gmail authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the Google authentication URL',
    schema: { type: 'string', example: 'https://accounts.google.com/o/oauth2/auth?...' },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while generating auth URL',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Error generating Google OAuth URL' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  getAuthUrl(): string {
    return this.emailService.getAuthUrl();
  }

  @Post('get-token')
  @ApiOperation({
    summary: 'Exchange OAuth code for token',
    description: 'Exchanges the OAuth authorization code for access and refresh tokens.',
  })
  @ApiBody({
    description: 'OAuth code payload',
    schema: {
      type: 'object',
      properties: { code: { type: 'string', example: '4/0AX4XfWg...' } },
      required: ['code'],
    },
    examples: {
      valid: {
        summary: 'Valid code',
        value: { code: '4/0AX4XfWg...' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token obtained successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid authorization code or missing required token data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' }, example: ['Invalid code'] },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while obtaining token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Error obtaining token' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getToken(
    @Body() body: { code: string },
    @CurrentUser() user: Partial<User>,
  ): Promise<GeneralResponseDto> {
    return await this.emailService.getToken(body.code, user);
  }

  @Get('sync-status')
  @ApiOperation({
    summary: 'Get email sync status',
    description: 'Returns the current status of email synchronization for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the sync status, including last sync time and number of emails scanned',
    type: StatusDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while retrieving sync status',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Error retrieving sync status' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getSyncStatus(@CurrentUser() user: Partial<User>): Promise<StatusDto> {
    return await this.emailService.getSyncStatus(user);
  }

  @Post('manual-sync')
  @ApiOperation({
    summary: 'Manually trigger email synchronization',
    description: 'Initiates a manual synchronization of emails for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Manual sync initiated successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while initiating manual sync',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Error initiating manual sync' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async manualSync(@CurrentUser() user: User): Promise<GeneralResponseDto> {
    return await this.emailService.manualSync(user);
  }
}
