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

      // 1. Find the user entity first to get the correct type for TypeORM
      const {user, emailEntity} = await this.findUserAndEmail(userId);

      // 3. Set up the Gmail API client with OAuth2
      const oauth2Client = new google.auth.OAuth2(
        envConstants.GOOGLE_CLIENT_ID,
        envConstants.GOOGLE_CLIENT_SECRET,
        envConstants.GOOGLE_REDIRECT_URI,
      );
      // set credentials
      oauth2Client.setCredentials({
        access_token: emailEntity.accessToken,
        refresh_token: emailEntity.refreshToken,
        expiry_date: emailEntity.expiresAt.getTime(),
      });
      // set scope
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      logger.info(`Gmail API client setup for user: ${user.id}`);

      // 4. Get label ID for the subscription label
      logger.info(`Getting label ID for subscription label: ${labelName}`);
      let labelsRes = await gmail.users.labels.list({ userId: 'me' });

      const labels = labelsRes.data.labels || [];
      const label = labels.find((l) => l.name === labelName);
      if (!label || !label.id){
          throw new BadRequestException(`Label '${labelName}' not found in user's Gmail`);

      }
      const labelId: string = label.id;
      logger.info(`Found label ID ${labelId} for label name ${labelName}`);

      // 5. Fetch emails with the subscription label
      let messagesRes = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [labelId],
          q: `newer_than:7d`,
          maxResults: 10,
        });

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
        // Fetch the full message details using the `get` method
          const msgRes = await gmail.users.messages.get({ userId: 'me', id: m.id });
          const msg = msgRes.data;

          await this.transactionService.create(user, JSON.stringify(msg));
          const progress = Math.round(((messages.indexOf(m) + 1) / jobProgress) * 100);
          await job.updateProgress(progress);
      }
      logger.info(`Extracted ${results.length} subscription details for user ${user.id}`);

      // 7. update last sync and email received
      logger.info(`Updating last sync and email received for user ${user.id}`);
      emailEntity.lastSyncAt = new Date();
      emailEntity.emailsReceived = messages.length;
      emailEntity.syncStatus = EmailSyncStatus.COMPLETED;
      await this.emailRepository.save(emailEntity);

      // 6. Save or process results as needed
      return results;
    } catch (e) {
      logger.error(`Email worker process error: ${e.message}`, e);
      throw e;
    }
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    logger.info(`Job ${job.id} is active`);
    await this.handleEvents(job, 'active');
  }

  @OnWorkerEvent('progress')
  async onProgress(job: Job, progress: number) {
    logger.info(`Job ${job.id} progress: ${progress}% complete`);
    await this.handleEvents(job, 'progress');
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    logger.info(`Job ${job.id} completed with result ${JSON.stringify(job.returnvalue)}`);
    await this.handleEvents(job, 'completed');
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error) {
    logger.error(`Job ${job.id} failed with error ${err.message}`);
    await this.handleEvents(job, 'failed');
  }

  private async handleEvents(job: Job, type: 'active' | 'progress' | 'completed' | 'failed') {
      const userId = (job.data as JobPayloadInterface).userId;
      const userDetails = await this.findUserAndEmail(userId);
      if (type === 'active') {
        userDetails.emailEntity.syncStatus = EmailSyncStatus.PENDING;
        userDetails.emailEntity.failedReason = null;
      } else if (type === 'progress') {
        userDetails.emailEntity.syncStatus = EmailSyncStatus.IN_PROGRESS;
        userDetails.emailEntity.failedReason = null;
      } else if (type === 'completed') {
        logger.info(`Job ${job.id} completed with result ${JSON.stringify(job.returnvalue)}`);
        userDetails.emailEntity.syncStatus = EmailSyncStatus.COMPLETED;
        userDetails.emailEntity.failedReason = null;
      } else if (type === 'failed') {
        userDetails.emailEntity.syncStatus = EmailSyncStatus.FAILED;
        userDetails.emailEntity.failedReason = job.returnvalue;
      }
      await this.emailRepository.save(userDetails.emailEntity);
  }

  private async findUserAndEmail(userId: number): Promise<{ user: User; emailEntity: Email }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      logger.error(`User with ID ${userId} not found`);
      throw new BadRequestException(`User with ID ${userId} not found`);
    }
    const emailEntity = await this.emailRepository.findOne({ where: { user: user } });
    if (!emailEntity) {
      logger.error(`Email credentials not found for user ${userId}`);
      throw new BadRequestException(`Email credentials not found for user ${userId}`);
    }
    return { user, emailEntity };
  }
}
