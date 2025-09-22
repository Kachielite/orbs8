import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { User } from '../auth/entities/user.entity';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { StatusDto } from './dto/status.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Email Management')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @ApiBearerAuth()
  @Get('get-auth')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get Google OAuth URL',
    description: 'Returns the Google OAuth URL for Gmail authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the Google authentication URL',
    type: String,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while generating auth URL',
  })
  getAuthUrl(): string {
    return this.emailService.getAuthUrl();
  }

  @ApiBearerAuth()
  @Post('get-token')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Exchange OAuth code for token',
    description: 'Exchanges the OAuth authorization code for access and refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Token obtained successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid authorization code or missing required token data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while obtaining token',
  })
  async getToken(
    @Body() body: { code: string },
    @CurrentUser() user: Partial<User>,
  ): Promise<GeneralResponseDto> {
    return await this.emailService.getToken(body.code, user);
  }

  @ApiBearerAuth()
  @Get('sync-status')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Get email sync status',
    description: 'Returns the current status of email synchronization for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the sync status, including last sync time and number of emails scanned',
    type: StatusDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while retrieving sync status',
  })
  async getSyncStatus(@CurrentUser() user: Partial<User>): Promise<StatusDto> {
    return await this.emailService.getSyncStatus(user);
  }

  @ApiBearerAuth()
  @Post('manual-sync')
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Manually trigger email synchronization',
    description: 'Initiates a manual synchronization of emails for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Manual sync initiated successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while initiating manual sync',
  })
  async manualSync(@CurrentUser() user: User): Promise<GeneralResponseDto> {
    return await this.emailService.manualSync(user);
  }
}
