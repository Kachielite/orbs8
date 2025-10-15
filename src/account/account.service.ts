import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { AccountDto } from './dto/account.dto';
import logger from '../common/utils/logger/logger';
import { Transaction, TransactionType } from '../transaction/entities/transaction.entity';
import { AccountSummaryDto } from './dto/account-summary.dto';
import { currencyConverter } from '../common/utils/currency-converter.util';
import { ExchangeRate } from './entities/exchange-rate.entity';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account) private readonly accountRepository: Repository<Account>,
    @InjectRepository(Transaction) private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(ExchangeRate)
    private readonly exchangeRateRepository: Repository<ExchangeRate>,
  ) {}

  async findAll(user: Partial<User>): Promise<AccountDto[]> {
    try {
      logger.info(`Fetching accounts for user: ${user.id}`);
      const accounts = await this.accountRepository.find({
        where: { user: { id: user.id } },
        relations: ['user', 'currency', 'bank'],
      });

      return accounts.map((account) => this.convertToDTO(account));
    } catch (error) {
      logger.error(`Error fetching accounts: ${error.message}`);
      throw new InternalServerErrorException(`Error fetching accounts: ${error.message}`);
    }
  }

  async findOne(id: number, user: Partial<User>) {
    try {
      logger.info(`Fetching account with ID: ${id} for user: ${user.id}`);

      const account = await this.accountRepository.findOne({
        where: { id, user: { id: user.id } },
        relations: ['user', 'currency', 'bank'],
      });

      if (!account) {
        throw new NotFoundException(`Account with ID ${id} not found for user ${user.id}`);
      }

      return this.convertToDTO(account);
    } catch (error) {
      logger.error(`Error fetching account with ID: ${id} for user: ${user.id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error fetching account with ID: ${id} for user: ${user.id}: ${error.message}`,
      );
    }
  }

  async accountSummary(user: Partial<User>): Promise<AccountSummaryDto> {
    try {
      logger.info(`Fetching account summary for user: ${user.id}`);

      // Get User Preferred Currency
      const preferredCurrency = user.preferredCurrency || 'USD';

      // Get User Bank Accounts
      const accounts = await this.accountRepository.find({
        where: { user: { id: user.id } },
        relations: ['user', 'currency', 'bank'],
      });

      // Get unique currencies for quotes
      const uniqueCurrencies = [
        ...new Set(accounts.map((a) => a.currency.code).filter((c) => c !== preferredCurrency)),
      ];
      const quotes: Record<string, number> = {};
      for (const code of uniqueCurrencies) {
        quotes[`${preferredCurrency}${code}`] = await this.getCachedExchangeRate(
          code,
          preferredCurrency,
        );
      }

      // Get unique number of banks
      const numberOfBanks = [...new Set(accounts.map((a) => a.bank.id))].length;

      // Convert currencies to preferred currency
      const accountWithConvertedCurrency = await Promise.all(
        accounts.map(async (account) => {
          if (account.currency.code === preferredCurrency) {
            return parseFloat(account.currentBalance.toString());
          }

          const rate = await this.getCachedExchangeRate(account.currency.code, preferredCurrency);
          const amount = parseFloat(account.currentBalance.toString());
          return rate * amount;
        }),
      );

      // Sum up all converted currencies
      const totalBalance = accountWithConvertedCurrency.reduce((acc, balance) => acc + balance, 0);

      // Format totalBalance to 2 decimal places
      const formattedTotalBalance = parseFloat(totalBalance.toFixed(2));

      // Get spend trend using QueryBuilder to avoid raw SQL syntax issues
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const currentRaw = await this.transactionRepository
        .createQueryBuilder('t')
        .select('SUM(t.amount)', 'total')
        .where('t.userId = :userId', { userId: user.id })
        .andWhere('t.type = :type', { type: TransactionType.DEBIT })
        .andWhere('t.transactionDate >= :fromDate', { fromDate: thirtyDaysAgo })
        .getRawOne<{ total: string | null }>();

      const previousRaw = await this.transactionRepository
        .createQueryBuilder('t')
        .select('SUM(t.amount)', 'total')
        .where('t.userId = :userId', { userId: user.id })
        .andWhere('t.type = :type', { type: TransactionType.DEBIT })
        .andWhere('t.transactionDate >= :fromDate', { fromDate: sixtyDaysAgo })
        .andWhere('t.transactionDate < :toDate', { toDate: thirtyDaysAgo })
        .getRawOne<{ total: string | null }>();

      const currentTotal = parseFloat(currentRaw?.total ?? '0') || 0;
      const previousTotal = parseFloat(previousRaw?.total ?? '0') || 0;

      const spendChange =
        previousTotal > 0
          ? Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(2))
          : 0;
      const numberOfAccounts = accounts.length;

      return new AccountSummaryDto(
        formattedTotalBalance,
        spendChange,
        numberOfAccounts,
        quotes,
        numberOfBanks,
      );
    } catch (error) {
      logger.error(`Error fetching account summary for user: ${user.id}: ${error.message}`);
      throw new InternalServerErrorException(`Error fetching account summary: ${error.message}`);
    }
  }

  // Cached exchange rate handling with scheduled updates and fallbacks
  private isWithinUpdateWindow(date: Date = new Date()): boolean {
    const HOUR_WINDOWS = [6, 12, 18];
    const WINDOW_MINUTES = 15; // 15-minute window
    const now = date;
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    return HOUR_WINDOWS.some((h) => currentHour === h && currentMinutes < WINDOW_MINUTES);
  }

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

  private async getCachedExchangeRate(from: string, to: string): Promise<number> {
    const pair = `${from}${to}`;
    const withinWindow = this.isWithinUpdateWindow();

    // Fetch existing record if any
    let record = await this.exchangeRateRepository.findOne({ where: { quotes: pair } });

    const tryUpdate = async () => {
      try {
        const rate = await this.fetchRateWithRetries(from, to, 2);
        if (!record) {
          record = this.exchangeRateRepository.create({
            quotes: pair,
            rate: rate.toString(),
            lastUpdated: new Date(),
            wasUpdated: true,
          });
        } else {
          record.rate = rate.toString();
          record.lastUpdated = new Date();
          record.wasUpdated = true;
        }
        await this.exchangeRateRepository.save(record);
        return rate;
      } catch (err) {
        // Mark as not updated if record exists
        if (record) {
          record.wasUpdated = false;
          await this.exchangeRateRepository.save(record);
          // Use cached value
          return parseFloat(record.rate);
        }
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Failed to update exchange rate');
      }
    };

    if (withinWindow) {
      // During window, prefer fresh update; fallback to cache
      return await tryUpdate();
    }

    // Outside window
    if (record) {
      if (!record.wasUpdated) {
        // Attempt to update if previous window failed
        try {
          return await tryUpdate();
        } catch {
          return parseFloat(record.rate);
        }
      }
      return parseFloat(record.rate);
    }

    // No record exists, fetch now
    return await tryUpdate();
  }

  private convertToDTO(account: Account): AccountDto {
    return new AccountDto(
      account.id,
      account.accountName,
      account.accountNumber,
      account.currentBalance,
      account.currency.name,
      account.currency.symbol,
      account.bank.id,
      account.bank.name,
    );
  }
}
