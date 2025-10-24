import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email, EmailSyncStatus } from './entities/email.entity';
import { User } from '../auth/entities/user.entity';
import { gmail_v1, google } from 'googleapis';
import { envConstants } from '../common/constants/env.secrets';
import logger from '../common/utils/logger/logger';
import { BadRequestException } from '@nestjs/common';
import { JobPayloadInterface } from './interface/job-payload.interface';
import { TransactionService } from '../transaction/transaction.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { OAuth2Client } from 'google-auth-library';

class EmailSyncError extends Error {
  constructor(
    message: string,
    public syncedCount: number,
    public totalEmails: number,
  ) {
    super(message);
    this.name = 'EmailSyncError';
  }
}

@Processor('email-sync')
export class EmailWorker extends WorkerHost {
  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly transactionService: TransactionService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job) {
    let syncedCount = 0;
    let totalEmails = 0;
    try {
      const userId = (job.data as JobPayloadInterface).userId;
      const labelName = (job.data as JobPayloadInterface).labelName;

      logger.info(
        `Start job ${job.id} for user: ${userId} to sync emails with label: ${labelName}`,
      );

      // 1. Find the user entity first to get the correct type for TypeORM
      const { user, emailEntity: initialEmailEntity } = await this.findUserAndEmail(userId);

      // 2. Check if token needs refresh and refresh if necessary
      const emailEntity = await this.ensureValidToken(initialEmailEntity, userId);

      // 3. Set up the Gmail API client with OAuth2
      const oauth2Client = new google.auth.OAuth2(
        envConstants.GOOGLE_CLIENT_ID,
        envConstants.GOOGLE_CLIENT_SECRET,
        envConstants.GOOGLE_REDIRECT_URI,
      );
      // set credentials
      oauth2Client.setCredentials({
        access_token: emailEntity.accessToken,
        refresh_token: emailEntity.refreshToken ?? undefined,
        expiry_date: emailEntity.expiresAt ? emailEntity.expiresAt.getTime() : undefined,
      });
      // set scope
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      logger.info(`Gmail API client setup for user: ${user.id}`);

      // 4. Get label ID for the subscription label
      logger.info(`Getting label ID for subscription label: ${labelName}`);
      const labelsRes = await gmail.users.labels.list({ userId: 'me' });

      const labels = labelsRes.data.labels || [];
      const label = labels.find((l) => l.name === labelName);
      if (!label || !label.id) {
        throw new BadRequestException(`Label '${labelName}' not found in user's Gmail`);
      }
      const labelId: string = label.id;
      logger.info(`Found label ID ${labelId} for label name ${labelName}`);

      // Check last sync time
      const lastSyncTime = emailEntity.lastSyncAt;
      let queryTimeBack = `newer_than:90d`;

      if (lastSyncTime) {
        // Gmail expects 'after:' in YYYY/MM/DD format (per search grammar). Use UTC date to avoid TZ issues.
        const year = lastSyncTime.getUTCFullYear();
        const month = String(lastSyncTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(lastSyncTime.getUTCDate()).padStart(2, '0');
        const afterDate = `${year}/${month}/${day}`;
        queryTimeBack = `after:${afterDate}`;
      }

      // 5. Fetch emails with the subscription label (with pagination)
      let pageToken: string | undefined = undefined;
      const messages: gmail_v1.Schema$Message[] = [];
      do {
        const messagesRes = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [labelId],
          q: queryTimeBack,
          pageToken,
          maxResults: 500, // grab as many as allowed per page to reduce round-trips
        });
        const pageMessages: gmail_v1.Schema$Message[] = Array.isArray(messagesRes.data.messages)
          ? (messagesRes.data.messages as gmail_v1.Schema$Message[])
          : [];
        messages.push(...pageMessages);
        pageToken = messagesRes.data.nextPageToken || undefined;
      } while (pageToken);

      totalEmails = messages.length;
      logger.info(`Found ${messages.length} emails with label ID ${labelId} for user ${user.id}`);

      // Fetch full message details and sort by internalDate to ensure chronological order (oldest first)
      const fullMessages: Array<{
        id: string;
        internalDate: string;
        msg: gmail_v1.Schema$Message;
      }> = [];
      for (const m of messages) {
        if (!m.id) continue;
        const msgRes = await gmail.users.messages.get({ userId: 'me', id: m.id });
        const msg = msgRes.data;
        fullMessages.push({ id: m.id, internalDate: msg.internalDate || '0', msg });
      }

      // Sort messages by internalDate ascending (oldest first)
      fullMessages.sort((a, b) => parseInt(a.internalDate) - parseInt(b.internalDate));

      // 6. Process each email and extract subscription details
      const results: Array<Record<string, unknown>> = [];
      logger.info(
        `Extracting subscription details from ${fullMessages.length} emails for user ${user.id}`,
      );

      const jobProgress = fullMessages.length;

      for (const item of fullMessages) {
        const msg = item.msg;

        // Extract only subject and body to save tokens
        const headers = msg.payload?.headers || [];
        const subjectRaw = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';

        // Extract body from the message payload
        let bodyRaw = '';
        if (msg.payload?.body?.data) {
          // Decode base64url encoded body
          bodyRaw = Buffer.from(msg.payload.body.data, 'base64url').toString('utf-8');
        } else if (msg.payload?.parts) {
          // If message has parts, look for text/plain or text/html
          for (const part of msg.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyRaw = Buffer.from(part.body.data, 'base64url').toString('utf-8');
              break;
            } else if (part.mimeType === 'text/html' && part.body?.data && !bodyRaw) {
              bodyRaw = Buffer.from(part.body.data, 'base64url').toString('utf-8');
            }
          }
        }

        // Normalize whitespace: trim and replace multiple spaces/newlines with single space
        const subject = subjectRaw.trim().replace(/\s+/g, ' ');
        const body = bodyRaw.trim().replace(/\s+/g, ' ');

        // Create a minimal email text with just subject and body
        const emailText = `Subject: ${subject}\n\nBody:\n${body}`;

        // Use Gmail internalDate as a safe fallback if the LLM-provided date is invalid
        const internalMs = parseInt(item.internalDate, 10);
        const fallbackDate = Number.isFinite(internalMs) ? new Date(internalMs) : undefined;

        await this.transactionService.create(user, emailText, { fallbackDate });
        syncedCount++;
        const progress = Math.round(((fullMessages.indexOf(item) + 1) / jobProgress) * 100);
        await job.updateProgress(progress);
      }
      logger.info(`Processed ${syncedCount}/${fullMessages.length} emails for user ${user.id}`);

      // 6. Save or process results as needed
      return { syncedCount, totalEmails, results };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      logger.error(`Email worker process error: ${errorMessage}`, e);
      // Return sync stats even on failure
      throw new EmailSyncError(errorMessage, syncedCount, totalEmails);
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
      userDetails.emailEntity.syncStatus = EmailSyncStatus.IN_PROGRESS;
      userDetails.emailEntity.failedReason = null;
      await this.emailRepository.save(userDetails.emailEntity);

      await this.notificationService.createAndEmit(
        'Email sync started',
        `Started syncing emails from your Gmail account.`,
        NotificationType.SYNC_STARTED,
        userId,
      );
    } else if (type === 'progress') {
      userDetails.emailEntity.syncStatus = EmailSyncStatus.IN_PROGRESS;
      userDetails.emailEntity.failedReason = null;
      await this.emailRepository.save(userDetails.emailEntity);

      const progress = job.progress as number;
      await this.notificationService.createAndEmit(
        'Email sync in progress',
        `Progress: ${progress}% complete.`,
        NotificationType.SYNC_PROGRESS,
        userId,
        true,
        progress,
      );
    } else if (type === 'completed') {
      logger.info(`Job ${job.id} completed with result ${JSON.stringify(job.returnvalue)}`);
      userDetails.emailEntity.syncStatus = EmailSyncStatus.COMPLETED;
      userDetails.emailEntity.lastSyncAt = new Date();
      userDetails.emailEntity.failedReason = null;
      await this.emailRepository.save(userDetails.emailEntity);

      const returnValue = job.returnvalue as {
        syncedCount: number;
        totalEmails: number;
        results: unknown[];
      };
      const syncedCount = returnValue?.syncedCount || 0;

      await this.notificationService.createAndEmit(
        'Email sync completed',
        syncedCount === 0
          ? `No new emails to synced from your Gmail account. Transactions are up to date.`
          : `Successfully synced ${syncedCount} emails from your Gmail account.`,
        NotificationType.SYNC_COMPLETED,
        userId,
      );
    } else if (type === 'failed') {
      userDetails.emailEntity.syncStatus = EmailSyncStatus.FAILED;
      userDetails.emailEntity.failedReason = job.returnvalue as string;
      userDetails.emailEntity.lastSyncAt = new Date();
      await this.emailRepository.save(userDetails.emailEntity);

      // Extract sync stats from the error if it's an EmailSyncError
      let syncedCount = 0;
      let totalEmails = 0;
      const failedError = job.failedReason;

      if (failedError && failedError.includes('EmailSyncError')) {
        const returnValue = job.returnvalue as { syncedCount?: number; totalEmails?: number };
        syncedCount = returnValue?.syncedCount || 0;
        totalEmails = returnValue?.totalEmails || 0;
      }

      const failedCount = totalEmails - syncedCount;
      let message = 'Failed to sync emails from your Gmail account.';
      if (totalEmails > 0) {
        message = `Synced ${syncedCount} out of ${totalEmails} emails. ${failedCount} email(s) failed to sync.`;
      }

      await this.notificationService.createAndEmit(
        'Email sync failed',
        message,
        NotificationType.SYNC_FAILED,
        userId,
      );
    }
  }

  private async ensureValidToken(emailEntity: Email, userId: number): Promise<Email> {
    try {
      const now = Date.now();
      const expiresAtMillis = emailEntity.expiresAt ? emailEntity.expiresAt.getTime() : undefined;

      const isAccessTokenMissing = !emailEntity.accessToken;
      const isExpired =
        typeof expiresAtMillis === 'number' ? expiresAtMillis <= now - 60_000 : false;
      const shouldRefresh = isAccessTokenMissing || isExpired;

      if (shouldRefresh) {
        if (!emailEntity.refreshToken) {
          logger.error(`Refresh token missing for user ${userId}`);

          // Mark email entity as needing reconnection
          emailEntity.syncStatus = EmailSyncStatus.FAILED;
          emailEntity.failedReason = 'Gmail access expired. Please reconnect your email account.';
          await this.emailRepository.save(emailEntity);

          throw new BadRequestException(
            'Gmail access has expired and no refresh token available. Please reconnect your email account.',
          );
        }

        logger.info(`Token expired or missing for user ${userId}, refreshing...`);
        const oauth2Client = new OAuth2Client(
          envConstants.GOOGLE_CLIENT_ID,
          envConstants.GOOGLE_CLIENT_SECRET,
          envConstants.GOOGLE_REDIRECT_URI,
        );

        oauth2Client.setCredentials({
          refresh_token: emailEntity.refreshToken,
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update email entity with new tokens
        emailEntity.accessToken = credentials.access_token ?? emailEntity.accessToken;
        if (credentials.expiry_date) {
          emailEntity.expiresAt = new Date(credentials.expiry_date);
        }
        if (credentials.refresh_token) {
          emailEntity.refreshToken = credentials.refresh_token;
        }

        await this.emailRepository.save(emailEntity);
        logger.info(`✅ Successfully refreshed token for user ${userId}`);
      } else {
        logger.info(`Token still valid for user ${userId}`);
      }

      return emailEntity;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Failed to ensure valid token for user ${userId}: ${message}`);

      if (message.includes('invalid_grant')) {
        // Mark email entity as needing reconnection
        emailEntity.syncStatus = EmailSyncStatus.FAILED;
        emailEntity.failedReason =
          'Gmail connection expired or revoked. Please reconnect your email account.';
        await this.emailRepository.save(emailEntity);

        // Update user's emailLinked status
        await this.userRepository.update({ id: userId }, { emailLinked: false });

        logger.warn(`⚠️  User ${userId} needs to reconnect their Gmail account`);

        throw new BadRequestException(
          'Gmail connection expired or revoked. Please reconnect your email account.',
        );
      }

      throw new BadRequestException('Failed to refresh Gmail token.');
    }
  }

  private async findUserAndEmail(userId: number): Promise<{ user: User; emailEntity: Email }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      logger.error(`User with ID ${userId} not found`);
      throw new BadRequestException(`User with ID ${userId} not found`);
    }
    // find email where userid is equal to user id
    const emailEntity = await this.emailRepository.findOne({
      where: { user: { id: user.id } as User },
      relations: ['user'],
    });

    if (!emailEntity) {
      logger.error(`Email credentials not found for user ${userId}`);
      throw new BadRequestException(`Email credentials not found for user ${userId}`);
    }
    return { user, emailEntity };
  }
}
