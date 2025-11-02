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
      let queryTimeBack = `newer_than:30d`;

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
        const fromRaw = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';

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

        // Sanitize subject and body: remove HTML, URLs, footer/signatures, fwd/reply headers, and normalize whitespace
        const cleanSubject = this.sanitizeSubject(subjectRaw);
        const cleanBody = this.sanitizeEmailBody(bodyRaw);

        // Create a minimal, single-line email text with subject and body back-to-back
        const parts: string[] = [];
        if (cleanSubject) parts.push(`Subject: ${cleanSubject}`);
        if (cleanBody) parts.push(`Body: ${cleanBody}`);
        const emailText = parts.join(' ');
        console.log('emailText:', emailText);

        // Use Gmail internalDate as a safe fallback if the LLM-provided date is invalid
        const internalMs = parseInt(item.internalDate, 10);
        const fallbackDate = Number.isFinite(internalMs) ? new Date(internalMs) : undefined;

        // Extract bank name hint from the From header (domain between @ and .com)
        const bankHint = this.extractBankNameFromSender(fromRaw);
        console.log('bankHint:', bankHint);

        await this.transactionService.create(user, emailText, { fallbackDate, bankHint });
        syncedCount++;

        // Update lastSyncAt to the time of this email
        const { emailEntity: currentEmailEntity } = await this.findUserAndEmail(userId);
        currentEmailEntity.lastSyncAt = fallbackDate || new Date();
        await this.emailRepository.save(currentEmailEntity);

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

  // --- Sanitization helpers ---
  private sanitizeSubject(input: string): string {
    return this.normalizeWhitespace(this.stripUrls(this.stripHtml(input)));
  }

  private sanitizeEmailBody(raw: string): string {
    // 1) convert HTML -> text
    let text = this.stripHtml(raw);
    // 2) remove URLs
    text = this.stripUrls(text);
    // 3) remove forwarded/replied headers embedded in body
    text = this.removeForwardHeaders(text);
    // 4) remove email signatures/footers
    text = this.stripFootersAndSignatures(text);
    // 5) normalize whitespace
    text = this.normalizeWhitespace(text);
    return text;
  }

  private stripHtml(input: string): string {
    if (!input) return '';
    let s = input;
    // remove script/style blocks
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    // replace <br> and closing block tags with newlines to retain structure
    s = s.replace(/<(br|br\s*\/|\/p|\/div|\/li)\s*\/?>/gi, '\n');
    // turn list items into lines
    s = s.replace(/<li[^>]*>/gi, '- ');
    // strip remaining tags
    s = s.replace(/<[^>]+>/g, ' ');
    // decode a few common HTML entities
    s = s
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
    return s;
  }

  private stripUrls(input: string): string {
    if (!input) return '';
    // remove http/https, www, and mailto links
    return input.replace(/\b(?:https?:\/\/|www\.)\S+|\bmailto:\S+/gi, ' ');
  }

  private removeForwardHeaders(input: string): string {
    if (!input) return '';
    const headerNames = [
      'from',
      'to',
      'cc',
      'bcc',
      'date',
      'subject',
      'sent',
      'mailed-by',
      'reply-to',
      'message-id',
      'content-type',
      'received',
      'dkim-signature',
    ];
    const headerRe = new RegExp(String.raw`^\s*(?:>+\s*)?(?:${headerNames.join('|')})\s*:`, 'i');
    const lines = input.split(/\r?\n/);

    // Remove obvious forward separators blocks and header lines
    const filtered = lines.filter((line) => {
      const isForwardSep =
        /^\s*-{2,}\s*forwarded message\s*-{2,}\s*$/i.test(line) ||
        /^\s*begin forwarded message\s*:?\s*$/i.test(line) ||
        /^\s*on .+ wrote:\s*$/i.test(line);
      if (isForwardSep) return false;
      return !headerRe.test(line);
    });

    return filtered.join('\n');
  }

  private stripFootersAndSignatures(input: string): string {
    if (!input) return '';
    const lines = input.split(/\r?\n/);

    // Common signature/footer markers
    const markers: RegExp[] = [
      /^\s*--\s*$/, // signature delimiter
      /^\s*sent from my /i,
      /^\s*best( regards)?\s*[,.-]*\s*$/i,
      /^\s*regards\s*[,.-]*\s*$/i,
      /^\s*kind regards\s*[,.-]*\s*$/i,
      /^\s*thanks( a lot| so much)?\s*[,.-]*\s*$/i,
      /^\s*thank you\s*[,.-]*\s*$/i,
      /^\s*cheers\s*[,.-]*\s*$/i,
      /^\s*sincerely\s*[,.-]*\s*$/i,
      /^\s*yours (faithfully|truly)\s*[,.-]*\s*$/i,
      /^\s*this email (and any attachments )?is confidential/i,
      /^\s*do not reply/i,
      /^\s*unsubscribe\b/i,
    ];

    // Walk from bottom and cut at the first marker found
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (markers.some((re) => re.test(line))) {
        return lines.slice(0, i).join('\n');
      }
    }

    return input;
  }

  private normalizeWhitespace(input: string): string {
    if (!input) return '';
    // Collapse all whitespace (including newlines and tabs) into single spaces and return one line
    return input.replace(/\s+/g, ' ').trim();
  }

  // Extract bank name hint from a From header value.
  // Examples:
  //  - "Notification <StanbicIBTC-E-Alert@stanbicibtc.com>" -> "stanbicibtc"
  //  - "GeNS@gtbank.com" -> "gtbank"
  //  - "-no_reply@accessbankplc.com" or "<no_reply@accessbankplc.com>" -> "accessbankplc"
  private extractBankNameFromSender(fromRaw: string | undefined | null): string | undefined {
    if (!fromRaw) return undefined;
    let value = String(fromRaw).trim();

    // If includes a display name with angle brackets, extract inside <...>
    const angle = value.match(/<([^>]+)>/);
    if (angle && angle[1]) {
      value = angle[1];
    }

    // If multiple addresses separated by commas, use the first
    if (value.includes(',')) value = value.split(',')[0].trim();

    // Extract domain part
    const atIdx = value.lastIndexOf('@');
    if (atIdx === -1) return undefined;
    let domain = value.slice(atIdx + 1).toLowerCase();
    domain = domain.replace(/[>\s].*$/, ''); // strip anything after space or >

    // Determine the primary label (bank identifier) from the domain
    const parts = domain.split('.').filter(Boolean);
    if (parts.length === 0) return undefined;

    let label = '';
    if (parts.length >= 3) {
      // Handle multi-level TLDs like co.uk, com.ng, co.za, com.gh etc.
      const last = parts[parts.length - 1];
      const secondLast = parts[parts.length - 2];
      const secondLevelTlds = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);
      if (last.length <= 2 && secondLevelTlds.has(secondLast)) {
        // e.g., something.co.uk => take third last
        label = parts[parts.length - 3] || '';
      } else {
        // default to the second last (immediately before TLD)
        label = secondLast || parts[0];
      }
    } else if (parts.length === 2) {
      // typical domain like bank.com
      label = parts[0];
    } else {
      // single label domain (rare)
      label = parts[0];
    }

    // Keep only letters to make lookup robust (remove digits, dashes, underscores)
    label = label.replace(/[^a-z]/g, '');

    return label || undefined;
  }
}
