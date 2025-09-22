import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email, EmailSyncStatus } from './entities/email.entity';
import { User } from '../auth/entities/user.entity';
import { gmail_v1, google } from 'googleapis';
import { envConstants } from '../common/constants/env.secrets';
import * as crypto from 'crypto';
import logger from '../common/utils/logger/logger';
import { BadRequestException } from '@nestjs/common';
import { JobPayloadInterface } from './interface/job-payload.interface';

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
  ) {
    super();
  }

  async process(job: Job) {
    logger.info(`Processing job ${job.id} with data ${JSON.stringify(job.data)}`);
    const userId = (job.data as JobPayloadInterface).userId;
    const labelName = (job.data as JobPayloadInterface).labelName;

    // 1. Find user entity first to get the correct type for TypeORM
    const user = await this.userRepository.findOne({ where: { id: Number(userId) } });
    if (!user) throw new BadRequestException(`User with ID ${userId} not found`);
    logger.info(`Processing job for user ${user.id}`);

    // 2. Fetch user's email credentials
    const emailEntity = await this.emailRepository.findOne({
      where: { user: user },
      relations: ['user'],
    });
    if (!emailEntity) throw new BadRequestException('Email credentials not found for user');
    logger.info(`Using email credentials for user ${user.id}`);

    // 3. Setup Gmail API client
    const oauth2Client = new google.auth.OAuth2(
      envConstants.GOOGLE_CLIENT_ID,
      envConstants.GOOGLE_CLIENT_SECRET,
      envConstants.GOOGLE_REDIRECT_URI,
    );
    oauth2Client.setCredentials({
      access_token: emailEntity.accessToken,
      refresh_token: emailEntity.refreshToken,
    });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    logger.info(`Gmail API client setup for user ${user.id}`);

    // 4. Get label ID for the subscription label
    logger.info(`Getting label ID for subscription label ${labelName}`);
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsRes.data.labels || [];
    const label = labels.find((l) => l.name === labelName);
    if (!label || !label.id)
      throw new BadRequestException(`Label '${labelName}' not found in user's Gmail`);
    const labelId: string = label.id;
    logger.info(`Found label ID ${labelId} for label name ${labelName}`);

    // 5. Fetch emails with the subscription label
    logger.info(`Fetching emails with label ID ${labelId} for user ${user.id}`);
    const messagesRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
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
      const msgRes = await gmail.users.messages.get({ userId: 'me', id: m.id });
      const msg = msgRes.data;
      const parsed = this.parseSubscriptionEmail(msg);
      if (!parsed) continue;
      results.push({
        user_id: user.id,
        service_name: parsed.service_name,
        status: parsed.status,
        billing_cycle: parsed.billing_cycle,
        amount: parsed.amount,
        currency: parsed.currency,
        next_payment_date: parsed.next_payment_date,
        trial_end_date: parsed.trial_end_date,
        hashed_message_id: crypto.createHash('sha256').update(m.id).digest('hex'),
        message_date: msg.internalDate ? new Date(Number(msg.internalDate)) : null,
        extraction_method: parsed.method,
        extraction_confidence: parsed.confidence,
        created_at: new Date(),
        updated_at: new Date(),
      });
      const progress = Math.round(((messages.length - messages.indexOf(m)) / jobProgress) * 100);
      await job.updateProgress(progress);
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

  // Improved parser: uses general regexes to extract fields from subject and body
  private parseSubscriptionEmail(msg: gmail_v1.Schema$Message): ParsedSubscription | null {
    // Extract headers and body
    const payload = msg.payload;
    const headers = Array.isArray(payload?.headers) ? payload.headers : [];
    const subjectHeader = headers.find((h) => h && h.name === 'Subject');
    const fromHeader = headers.find((h) => h && h.name === 'From');
    const subject =
      subjectHeader && typeof subjectHeader.value === 'string' ? subjectHeader.value : '';
    const from = fromHeader && typeof fromHeader.value === 'string' ? fromHeader.value : '';

    // Get plain text body (if available)
    let body = '';
    if (Array.isArray(payload?.parts)) {
      const textPart = payload.parts.find((p) => p && p.mimeType === 'text/plain');
      if (textPart && textPart.body && typeof textPart.body.data === 'string') {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    } else if (payload?.body && typeof payload.body.data === 'string') {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    const text = `${subject}\n${body}`;

    // Service name: try to infer from sender or subject
    let service_name: string | null = null;
    const knownServices = [
      { name: 'Netflix', pattern: /netflix/i },
      { name: 'Spotify', pattern: /spotify/i },
      { name: 'Apple', pattern: /apple/i },
      { name: 'Amazon', pattern: /amazon/i },
      { name: 'YouTube', pattern: /youtube/i },
      { name: 'Hulu', pattern: /hulu/i },
      { name: 'Disney', pattern: /disney/i },
      // Add more as needed
    ];
    for (const svc of knownServices) {
      if (
        (typeof from === 'string' && svc.pattern.test(from)) ||
        (typeof subject === 'string' && svc.pattern.test(subject))
      ) {
        service_name = svc.name;
        break;
      }
    }
    if (!service_name) {
      // Try to extract from subject (e.g., 'Your Acme subscription')
      const subjMatch =
        typeof subject === 'string' ? subject.match(/your (.*?) subscription/i) : null;
      if (subjMatch && subjMatch[1]) service_name = String(subjMatch[1]);
    }

    // Amount and currency
    const amountMatch = text.match(/(?:\$|USD|EUR|GBP|₦|NGN)?\s?([0-9]+(?:\.[0-9]{2})?)/i);
    const currencyMatch = text.match(/(USD|EUR|GBP|₦|NGN|dollars|euros|pounds)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    let currency = currencyMatch ? currencyMatch[1].toUpperCase() : null;
    if (currency === 'DOLLARS') currency = 'USD';
    if (currency === 'EUROS') currency = 'EUR';
    if (currency === 'POUNDS') currency = 'GBP';

    // Billing cycle
    const billingMatch = text.match(/(monthly|yearly|weekly|annual|annually|quarterly)/i);
    const billing_cycle = billingMatch ? billingMatch[1].toLowerCase() : null;
    // Status
    const statusMatch = text.match(/(active|paused|canceled|cancelled|free trial)/i);
    const status = statusMatch
      ? statusMatch[1].replace('cancelled', 'canceled').replace('free trial', 'free_trial')
      : null;

    // Next payment date
    const dateMatch = text.match(/(\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\w+ \d{1,2}, \d{4}\b)/);
    const next_payment_date = dateMatch ? new Date(dateMatch[1]) : null;
    // Trial end date (look for 'trial ends on ...')
    const trialMatch = text.match(
      /trial (?:ends|end) on (\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\w+ \d{1,2}, \d{4}\b)/i,
    );
    const trial_end_date = trialMatch ? new Date(trialMatch[1]) : null;

    // Only return if at least service_name and amount or billing_cycle are found
    if (!service_name && !amount && !billing_cycle) return null;

    return {
      service_name,
      status,
      billing_cycle,
      amount,
      currency,
      next_payment_date,
      trial_end_date,
      method: 'general-regex',
      confidence: 0.5 + (service_name ? 0.2 : 0) + (amount ? 0.1 : 0) + (billing_cycle ? 0.1 : 0),
    };
  }
}
