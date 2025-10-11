import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email, EmailSyncStatus } from './entities/email.entity';
import { User } from '../auth/entities/user.entity';
import { google } from 'googleapis';
import { envConstants } from '../common/constants/env.secrets';
import logger from '../common/utils/logger/logger';
import { BadRequestException } from '@nestjs/common';
import { JobPayloadInterface } from './interface/job-payload.interface';
import { TransactionService } from '../transaction/transaction.service';

interface ParsedSubscription {
  service_name: string | null;
  status: string | null;
  billing_cycle: string | null;
  amount: number | null;
  currency: string | null;
  next_payment_date: Date | null;
  trial_end_date: Date | null;
  method: string;
  confidence: number;
}

@Processor('email-sync')
export class EmailWorker extends WorkerHost {
  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly transactionService: TransactionService,
  ) {
    super();
  }

  async process(job: Job) {
    try {
      const userId = (job.data as JobPayloadInterface).userId;
      const labelName = (job.data as JobPayloadInterface).labelName;

      logger.info(
        `Start job ${job.id} for user: ${userId} to sync emails with label: ${labelName}`,
      );

      // 1. Find user entity first to get the correct type for TypeORM
      const user = await this.userRepository.findOne({ where: { id: Number(userId) } });
      if (!user) throw new BadRequestException(`User with ID ${userId} not found`);
      logger.info(`Found user details for ${user.id}`);

      // 2. Fetch user's email credentials
      const emailEntity = await this.emailRepository.findOne({
        where: { user: { id: user.id } },
      });
      if (!emailEntity) throw new BadRequestException('Email credentials not found for user');
      logger.info(`Using email credentials for user ${user.id}`);

      // 3. Setup Gmail API client with token refresh helper
      const oauth2Client = new google.auth.OAuth2(
        envConstants.GOOGLE_CLIENT_ID,
        envConstants.GOOGLE_CLIENT_SECRET,
        envConstants.GOOGLE_REDIRECT_URI,
      );

      // Helper function to refresh token
      const refreshTokenIfNeeded = async () => {
        const now = new Date();
        // Refresh if token expires within 5 minutes
        if (emailEntity.expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
          logger.info(`Access token expired or expiring soon for user ${user.id}, refreshing...`);
          try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            emailEntity.accessToken = credentials.access_token!;
            if (credentials.expiry_date) {
              emailEntity.expiresAt = new Date(credentials.expiry_date);
            }
            if (credentials.refresh_token) {
              emailEntity.refreshToken = credentials.refresh_token;
            }
            await this.emailRepository.save(emailEntity);
            logger.info(`Access token refreshed successfully for user ${user.id}`);

            // Update oauth2Client with new token
            oauth2Client.setCredentials({
              access_token: credentials.access_token,
              refresh_token: credentials.refresh_token || emailEntity.refreshToken,
            });
          } catch (refreshError) {
            logger.error(`Failed to refresh token for user ${user.id}: ${refreshError.message}`);
            throw new BadRequestException('Failed to refresh access token. Please re-authenticate.');
          }
        } else {
          oauth2Client.setCredentials({
            access_token: emailEntity.accessToken,
            refresh_token: emailEntity.refreshToken,
          });
        }
      };

      await refreshTokenIfNeeded();

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      logger.info(`Gmail API client setup for user: ${user.id}`);

      // 4. Get label ID for the subscription label
      logger.info(`Getting label ID for subscription label: ${labelName}`);
      let labelsRes;
      try {
        labelsRes = await gmail.users.labels.list({ userId: 'me' });
      } catch (labelError) {
        if (labelError.code === 403 || labelError.status === 403) {
          logger.warn(`Got 403 error, attempting token refresh for user ${user.id}`);
          await refreshTokenIfNeeded();
          labelsRes = await gmail.users.labels.list({ userId: 'me' });
        } else {
          throw labelError;
        }
      }
      const labels = labelsRes.data.labels || [];
      const label = labels.find((l) => l.name === labelName);
      if (!label || !label.id)
        throw new BadRequestException(`Label '${labelName}' not found in user's Gmail`);
      const labelId: string = label.id;
      logger.info(`Found label ID ${labelId} for label name ${labelName}`);

      // 5. Fetch emails with the subscription label
      let messagesRes;
      try {
        messagesRes = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [labelId],
          q: `newer_than:7d`,
          maxResults: 10,
        });
      } catch (listError) {
        if (listError.code === 403 || listError.status === 403) {
          logger.warn(`Got 403 error on messages.list, attempting token refresh for user ${user.id}`);
          await refreshTokenIfNeeded();
          messagesRes = await gmail.users.messages.list({
            userId: 'me',
            labelIds: [labelId],
            q: `newer_than:7d`,
            maxResults: 10,
          });
        } else {
          throw listError;
        }
      }
      const messages = Array.isArray(messagesRes.data.messages) ? messagesRes.data.messages : [];
      logger.info(`Found ${messages.length} emails with label ID ${labelId} for user ${user.id}`);

      // 6. Process each email and extract subscription details
      const results: Array<Record<string, unknown>> = [];
      logger.info(
        `Extracting subscription details from ${messages.length} emails for user ${user.id}`,
      );

      const jobProgress = messages.length;

      for (const m of messages) {
        if (!m.id) continue;

        try {
          // Fetch the full message details using the `get` method
          const msgRes = await gmail.users.messages.get({ userId: 'me', id: m.id });
          const msg = msgRes.data;

          await this.transactionService.create(user, JSON.stringify(msg));
          const progress = Math.round(((messages.indexOf(m) + 1) / jobProgress) * 100);
          await job.updateProgress(progress);
        } catch (msgError) {
          if (msgError.code === 403 || msgError.status === 403) {
            logger.warn(`Got 403 error on message ${m.id}, attempting token refresh for user ${user.id}`);
            await refreshTokenIfNeeded();
            // Retry the message fetch
            const msgRes = await gmail.users.messages.get({ userId: 'me', id: m.id });
            const msg = msgRes.data;
            await this.transactionService.create(user, JSON.stringify(msg));
            const progress = Math.round(((messages.indexOf(m) + 1) / jobProgress) * 100);
            await job.updateProgress(progress);
          } else {
            logger.error(`Error processing message ${m.id}: ${msgError.message}`);
            // Continue with next message instead of failing entire job
          }
        }
      }
      logger.info(`Extracted ${results.length} subscription details for user ${user.id}`);

      // 7. update last sync and email received
      logger.info(`Updating last sync and email received for user ${user.id}`);
      emailEntity.lastSyncAt = new Date();
      emailEntity.emailsReceived = messages.length;
      await this.emailRepository.save(emailEntity);
      // 6. Save or process results as needed
      // await this.saveExtractedSubscriptions(results);
      return results;
    } catch (e) {
      logger.error(`Email worker process error: ${e.message}`, e);
      throw e;
    }
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    logger.info(`Job ${job.id} is active`);
    const userId = (job.data as JobPayloadInterface).userId;
    const user = await this.userRepository.findOne({ where: { id: Number(userId) } });
    if (!user) return;
    const emailEntity = await this.emailRepository.findOne({
      where: { user: user },
      relations: ['user'],
    });
    if (!emailEntity) return;
    emailEntity.syncStatus = EmailSyncStatus.IN_PROGRESS;
    emailEntity.failedReason = null;
    await this.emailRepository.save(emailEntity);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    logger.info(`Job ${job.id} progress: ${progress}% complete`);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    logger.info(`Job ${job.id} completed with result ${JSON.stringify(job.returnvalue)}`);
    const userId = (job.data as JobPayloadInterface).userId;
    const user = await this.userRepository.findOne({ where: { id: Number(userId) } });
    if (!user) return;
    const emailEntity = await this.emailRepository.findOne({
      where: { user: user },
      relations: ['user'],
    });
    if (!emailEntity) return;
    emailEntity.syncStatus = EmailSyncStatus.COMPLETED;
    emailEntity.failedReason = null;
    await this.emailRepository.save(emailEntity);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error) {
    logger.error(`Job ${job.id} failed with error ${err.message}`);
    const userId = (job.data as JobPayloadInterface).userId;
    const user = await this.userRepository.findOne({ where: { id: Number(userId) } });
    if (!user) return;
    const emailEntity = await this.emailRepository.findOne({
      where: { user: user },
      relations: ['user'],
    });
    if (!emailEntity) return;
    emailEntity.syncStatus = EmailSyncStatus.FAILED;
    emailEntity.failedReason = err.message;
    await this.emailRepository.save(emailEntity);
  }
}
