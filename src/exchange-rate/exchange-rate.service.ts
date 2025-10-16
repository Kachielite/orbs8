import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from '../account/entities/exchange-rate.entity';
import { currencyConverter } from '../common/utils/currency-converter.util';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly HOUR_WINDOWS = [6, 12, 18];
  private readonly WINDOW_MINUTES = 15; // 15-minute window

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly exchangeRateRepository: Repository<ExchangeRate>,
  ) {}

  // If a rate is not present it will attempt a fetch-and-save as a fallback.
  async getRate(from: string, to: string): Promise<number> {
    const pair = `${from}${to}`;
    const record = await this.exchangeRateRepository.findOne({ where: { quotes: pair } });

    if (record) {
      // Return cached value if present; fallback to attempt update if no lastUpdated
      return parseFloat(record.rate);
    }

    // No record - fetch now and persist
    const rate = await this.fetchRateWithRetries(from, to, 2);
    const newRec = this.exchangeRateRepository.create({
      quotes: pair,
      rate: rate.toString(),
      lastUpdated: new Date(),
      wasUpdated: true,
    });
    await this.exchangeRateRepository.save(newRec);
    return rate;
  }

  // Exposed method for other modules to get the latest known rate for a pair.

  // It updates all known pairs. Failures for individual pairs are recorded by setting wasUpdated=false.
  @Cron('*/5 * * * *')
  async handleScheduledUpdate(): Promise<void> {
    try {
      if (!this.isWithinUpdateWindow()) {
        return;
      }

      this.logger.debug('ExchangeRate scheduled update running within update window');

      const records = await this.exchangeRateRepository.find();

      // Update each record; if fetch fails, set wasUpdated = false and leave previous rate
      for (const rec of records) {
        const pair = rec.quotes;
        // split pair into two 3-letter-ish parts; if not possible, attempt fetch using substrings
        const from = pair.slice(0, 3);
        const to = pair.slice(3);
        try {
          const rate = await this.fetchRateWithRetries(from, to, 2);
          rec.rate = rate.toString();
          rec.lastUpdated = new Date();
          rec.wasUpdated = true;
          await this.exchangeRateRepository.save(rec);
          this.logger.debug(`Updated exchange rate for ${pair}: ${rate}`);
        } catch (err) {
          rec.wasUpdated = false;
          await this.exchangeRateRepository.save(rec);
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to update exchange rate for ${pair}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`ExchangeRate scheduled update failed: ${msg}`);
    }
  }

  // Determines if now is within the scheduled update window
  private isWithinUpdateWindow(date: Date = new Date()): boolean {
    const now = date;
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    return this.HOUR_WINDOWS.some((h) => currentHour === h && currentMinutes < this.WINDOW_MINUTES);
  }

  // Cron job runs every 5 minutes and performs updates only during the configured windows.

  // Fetch from upstream with retries and exponential backoff
  private async fetchRateWithRetries(from: string, to: string, retries = 2): Promise<number> {
    let lastErrorMessage: string | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const conversion = await currencyConverter(from, to, 1);
        return conversion.rate;
      } catch (err: unknown) {
        lastErrorMessage = err instanceof Error ? err.message : String(err);
        const delayMs = 200 * Math.pow(2, attempt);
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
    throw new Error(lastErrorMessage ?? 'Failed to fetch exchange rate');
  }
}
