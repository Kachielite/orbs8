import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { envConstants } from '../common/constants/env.secrets';
import { OAuth2Client } from 'google-auth-library';
import logger from '../common/utils/logger/logger';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Email, EmailProvider } from './entities/email.entity';
import { DeepPartial, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { StatusDto } from './dto/status.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailSyncStatus } from './entities/email-sync-status.enum';

@Injectable()
export class EmailService {
  private oauth2Client: OAuth2Client;
  private SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly', // read-only
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectQueue('email-sync') private readonly emailSyncQueue: any,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      envConstants.GOOGLE_CLIENT_ID,
      envConstants.GOOGLE_CLIENT_SECRET,
      envConstants.GOOGLE_REDIRECT_URI,
    );
  }

  getAuthUrl(): string {
    try {
      logger.info('Getting google auth url');
      return this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.SCOPES,
        prompt: 'consent',
      });
    } catch (error) {
      logger.error(`Failed to get auth url: ${error.message}`);
      throw new InternalServerErrorException(`Failed to get auth url: ${error.message}`);
    }
  }

  async getToken(code: string, user: User): Promise<GeneralResponseDto> {
    try {
      logger.info('Obtaining Gmail access');
      const accessData = await this.oauth2Client.getToken(code);

      if (
        !accessData.tokens.refresh_token &&
        !accessData.tokens.access_token &&
        !accessData.tokens.expiry_date
      ) {
        throw new BadRequestException('Failed to obtain access token');
      }

      // Check expiry_date is defined
      if (!accessData.tokens.expiry_date) {
        throw new BadRequestException('Token expiry date is missing');
      }

      // Save token details
      logger.info('Gmail access obtained, saving token details');
      const newEmailAccess = this.emailRepository.create({
        user: user,
        provider: EmailProvider.GMAIL,
        accessToken: accessData.tokens.access_token!,
        refreshToken: accessData.tokens.refresh_token ?? null,
        expiresAt: new Date(accessData.tokens.expiry_date),
      } as DeepPartial<Email>);

      await this.emailRepository.save(newEmailAccess);
      return new GeneralResponseDto('Gmail access obtained successfully');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      logger.error(`Failed to obtain Gmail access: ${error.message}`);
      throw new InternalServerErrorException(`Failed to obtain Gmail access: ${error.message}`);
    }
  }

  async getSyncStatus(user: User): Promise<StatusDto> {
    try {
      logger.info(`Getting sync status for user: ${user.id}`);

      const source = await this.emailRepository.findOne({
        where: {
          user: user,
        },
        relations: ['user'],
      });

      if (!source) {
        logger.error(`Sync status not found for user: ${user.id}`);
        return new StatusDto(false);
      }

      const connection = !!source.accessToken && !!source.refreshToken;

      return new StatusDto(connection, source.emailsReceived, source.lastSyncAt);
    } catch (error) {
      logger.error(`Failed to get sync status: ${error.message}`);
      throw new InternalServerErrorException(`Failed to get sync status: ${error.message}`);
    }
  }

  async manualSync(user: User): Promise<GeneralResponseDto> {
    try {
      logger.info(`Manual sync initiated for user: ${user.id}`);
      // Set syncStatus to PENDING before queuing the job
      await this.updateSyncStatus(user, EmailSyncStatus.PENDING);
      // Add job to the queue
      await this.emailSyncQueue.add('sync-emails', { userId: user.id });
      return new GeneralResponseDto('Manual sync initiated successfully');
    } catch (error) {
      await this.updateSyncStatus(user, EmailSyncStatus.FAILED, error.message);
      logger.error(`Failed to initiate manual sync: ${error.message}`);
      throw new InternalServerErrorException(`Failed to initiate manual sync: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledSync() {
    logger.info('Scheduled sync started');
    const users = await this.userRepository.find();
    for (const user of users) {
      try {
        // Set syncStatus to PENDING before queuing the job
        await this.updateSyncStatus(user, EmailSyncStatus.PENDING);
        await this.emailSyncQueue.add('sync-emails', { userId: user.id });
        logger.info(`Scheduled sync queued for user: ${user.id}`);
      } catch (err) {
        await this.updateSyncStatus(user, EmailSyncStatus.FAILED, err.message);
        logger.error(`Failed to queue scheduled sync for user ${user.id}: ${err.message}`);
        throw new InternalServerErrorException(
          `Failed to queue scheduled sync for user ${user.id}: ${err.message}`,
        );
      }
    }
    logger.info('Scheduled sync completed');
  }

  private async updateSyncStatus(
    user: User,
    status: EmailSyncStatus,
    failedReason?: string,
  ): Promise<void> {
    const emailEntity = await this.emailRepository.findOne({
      where: { user: user },
      relations: ['user'],
    });
    if (emailEntity) {
      emailEntity.syncStatus = status;
      emailEntity.failedReason = failedReason ?? null;
      await this.emailRepository.save(emailEntity);
    }
    return;
  }
}
