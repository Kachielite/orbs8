import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { envConstants } from '../common/constants/env.secrets';
import { OAuth2Client } from 'google-auth-library';
import logger from '../common/utils/logger/logger';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Email, EmailProvider, EmailSyncStatus } from './entities/email.entity';
import { DeepPartial, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { StatusDto } from './dto/status.dto';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class EmailService {
  private readonly oauth2Client: OAuth2Client;
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

  async getToken(code: string, user: Partial<User>): Promise<GeneralResponseDto> {
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

      // Check if email tokens already exist for the user
      const existingEmail = await this.emailRepository.findOne({
        where: { user: { id: user.id } as User, provider: EmailProvider.GMAIL },
        relations: ['user'],
      });

      // Save token details
      logger.info('Gmail access obtained, saving token details');
      const expiresAtValue = accessData.tokens.expiry_date
        ? new Date(accessData.tokens.expiry_date)
        : null;

      if (existingEmail) {
        // update access and refresh token
        this.emailRepository.merge(existingEmail, {
          lastSyncAt: new Date(),
          accessToken: accessData.tokens.access_token!,
          refreshToken: accessData.tokens.refresh_token,
          expiresAt: expiresAtValue!,
        });

        return new GeneralResponseDto('Gmail access updated successfully');
      }

      const newEmailAccess = this.emailRepository.create({
        user: { id: user.id } as User,
        provider: EmailProvider.GMAIL,
        accessToken: accessData.tokens.access_token,
        refreshToken: accessData.tokens.refresh_token,
        expiresAt: expiresAtValue,
      } as DeepPartial<Email>);

      await this.emailRepository.save(newEmailAccess);

      return new GeneralResponseDto('Gmail access obtained successfully');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to obtain Gmail access: ${message}`);
      throw new InternalServerErrorException(`Failed to obtain Gmail access: ${message}`);
    }
  }

  async getSyncStatus(user: Partial<User>): Promise<StatusDto> {
    try {
      logger.info(`Getting sync status for user: ${user.id}`);

      const source = await this.emailRepository.findOne({
        where: {
          user: { id: user.id } as User,
        },
        relations: ['user'],
      });

      if (!source) {
        logger.error(`Sync status not found for user: ${user.id}`);
        return new StatusDto(EmailSyncStatus.IDLE);
      }

      return new StatusDto(source.syncStatus, source.emailsReceived, source.lastSyncAt);
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
      // get label name
      const emailEntity = await this.emailRepository.find({
        where: { user: { id: user.id } as User },
        relations: ['user'],
      });

      const labelName = emailEntity[0]?.labelName;

      if (!labelName) {
        throw new BadRequestException('Email label not set. Please verify label access first.');
      }

      // Add job to the queue
      await this.emailSyncQueue.add('sync-emails', {
        userId: user.id,
        labelName,
      });

      return new GeneralResponseDto('Manual sync initiated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateSyncStatus(user, EmailSyncStatus.FAILED, message);
      logger.error(`Failed to initiate manual sync: ${message}`);
      throw new InternalServerErrorException(`Failed to initiate manual sync: ${message}`);
    }
  }

  async verifyAccessToEmailLabel(
    user: Partial<User>,
    labelName: string,
  ): Promise<GeneralResponseDto> {
    try {
      logger.info(`Verifying access to email and label for user: ${user.id}`);
      const emailEntity = await this.emailRepository.findOne({
        where: { user: { id: user.id } as User },
        relations: ['user'],
      });
      if (!emailEntity) {
        throw new BadRequestException('Email not linked');
      }
      const now = Date.now();
      const expiresAtMillis = emailEntity.expiresAt ? emailEntity.expiresAt.getTime() : undefined;
      this.oauth2Client.setCredentials({
        access_token: emailEntity.accessToken,
        refresh_token: emailEntity.refreshToken ?? undefined,
        expiry_date: expiresAtMillis,
      });

      const isAccessTokenMissing = !emailEntity.accessToken;
      const isExpired =
        typeof expiresAtMillis === 'number' ? expiresAtMillis <= now - 60_000 : false;
      const shouldRefresh = isAccessTokenMissing || isExpired;

      if (shouldRefresh) {
        if (!emailEntity.refreshToken) {
          logger.warn(`Refresh token missing for user ${user.id}`);
          throw new BadRequestException(
            'Gmail access has expired. Please reconnect your email account.',
          );
        }

        logger.info(`Refreshing Gmail access token for user: ${user.id}`);
        await this.refreshGmailAccessToken(user.id as number, emailEntity);
      }

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      // Verify access to the email account
      await gmail.users.getProfile({ userId: 'me' });
      // If a labelName is provided, verify access to that label
      const res = await gmail.users.labels.list({ userId: 'me' });
      const labels = res.data.labels || [];
      const labelExists = labels.some((label) => label.name === labelName);
      logger.info(`Label "${labelName}" exists: ${labelExists}`);

      if (!labelExists) {
        throw new BadRequestException(`Label "${labelName}" does not exist`);
      }

      // save label name
      emailEntity.labelName = labelName;
      logger.info(`Saving label name "${labelName}" for user: ${user.id}`);
      await this.emailRepository.save(emailEntity);

      logger.info(`Updating user's emailLinked status to true for user: ${user.id}`);
      await this.userRepository.update({ id: user.id }, { emailLinked: true });

      logger.info(`Label "${labelName}" verified successfully`);
      return new GeneralResponseDto(`Access to email label: ${labelName} verified`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('invalid_grant')) {
        logger.warn(
          `Invalid grant detected while verifying label for user ${user.id}. Prompting re-authorization.`,
        );
        throw new BadRequestException(
          'Gmail access has been revoked. Please reconnect your email account.',
        );
      }
      logger.error(`Failed to verify access to email label: ${message}`);
      throw new BadRequestException(
        `Failed to verify access to the email label. Please ensure the label exists in Gmail and the spelling matches exactly.`,
      );
    }
  }

  // @Cron(CronExpression.EVERY_HOUR)
  async scheduledSync() {
    logger.info('Scheduled sync started');
    const users = await this.userRepository.find();
    for (const user of users) {
      try {
        // Get labelName
        const labelName = await this.emailRepository.findOne({
          where: { user: { id: user.id } as User },
          relations: ['user'],
        });
        // Set syncStatus to PENDING before queuing the job
        await this.updateSyncStatus(user, EmailSyncStatus.PENDING);
        await this.emailSyncQueue.add('sync-emails', { userId: user.id, labelName });
        logger.info(`Scheduled sync queued for user: ${user.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.updateSyncStatus(user, EmailSyncStatus.FAILED, message);
        logger.error(`Failed to queue scheduled sync for user ${user.id}: ${message}`);
        throw new InternalServerErrorException(
          `Failed to queue scheduled sync for user ${user.id}: ${message}`,
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
      where: { user: { id: user.id } as User },
      relations: ['user'],
    });
    if (emailEntity) {
      emailEntity.syncStatus = status;
      emailEntity.failedReason = failedReason ?? null;
      await this.emailRepository.save(emailEntity);
    }
    return;
  }

  private async refreshGmailAccessToken(userId: number, emailEntity: Email) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: emailEntity.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update local copy
      emailEntity.accessToken = credentials.access_token ?? emailEntity.accessToken;
      if (credentials.expiry_date) {
        emailEntity.expiresAt = new Date(credentials.expiry_date);
      }
      if (credentials.refresh_token) {
        // Occasionally Google rotates refresh tokens; store new one if provided
        emailEntity.refreshToken = credentials.refresh_token;
      }

      await this.emailRepository.save(emailEntity);

      // Reapply updated credentials
      this.oauth2Client.setCredentials({
        access_token: emailEntity.accessToken,
        refresh_token: emailEntity.refreshToken,
        expiry_date: emailEntity.expiresAt ? emailEntity.expiresAt.getTime() : undefined,
      });

      logger.info(`✅ Refreshed Gmail token successfully for user ${userId}`);
      return emailEntity;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Failed to refresh Gmail token for user ${userId}: ${message}`);

      // When refresh token becomes invalid — must reauthorize
      if (message.includes('invalid_grant')) {
        throw new BadRequestException(
          'Gmail connection expired or revoked. Please reconnect your email account.',
        );
      }

      throw new BadRequestException('Failed to refresh Gmail token.');
    }
  }
}
