import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { AccountDto } from './dto/account.dto';
import logger from '../common/utils/logger/logger';
import { Transaction } from '../transaction/entities/transaction.entity';
import { AccountSummaryDto } from './dto/account-summary.dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account) private readonly accountRepository: Repository<Account>,
    @InjectRepository(Transaction) private readonly transactionRepository: Repository<Transaction>,
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

      // Get total balance and number of accounts
      const accountData = (await this.accountRepository
        .createQueryBuilder('account')
        .select('SUM(account.currentBalance)', 'totalBalance')
        .addSelect('COUNT(account.id)', 'numberOfAccounts')
        .where('account.user.id = :userId', { userId: user.id })
        .getRawOne()) as { totalBalance: string; numberOfAccounts: string } | null;

      // Get spend trend
      const spendQuery = `
        WITH current_period AS (
          SELECT SUM(amount) AS total
          FROM transaction
          WHERE "userId" = ? AND type = 'debit'
            AND "transactionDate" >= CURRENT_DATE - INTERVAL '30 days'
        ),
        previous_period AS (
          SELECT SUM(amount) AS total
          FROM transaction
          WHERE "userId" = ? AND type = 'debit'
            AND "transactionDate" >= CURRENT_DATE - INTERVAL '60 days'
            AND "transactionDate" < CURRENT_DATE - INTERVAL '30 days'
        )
        SELECT
          c.total AS current_total,
          p.total AS previous_total,
          ROUND(((c.total - p.total) / NULLIF(p.total, 0)) * 100, 2) AS percent_change
        FROM current_period c, previous_period p;
      `;
      const spendResult: Array<{
        current_total: string | null;
        previous_total: string | null;
        percent_change: string | null;
      }> = await this.transactionRepository.query(spendQuery, [user.id, user.id]);

      const totalBalance = parseFloat(accountData?.totalBalance || '0') || 0;
      const numberOfAccounts = parseInt(accountData?.numberOfAccounts || '0') || 0;
      const spendChange = parseFloat(String(spendResult[0]?.percent_change || '0')) || 0;

      return new AccountSummaryDto(totalBalance, spendChange, numberOfAccounts);
    } catch (error) {
      logger.error(`Error fetching account summary for user: ${user.id}: ${error.message}`);
      throw new InternalServerErrorException(`Error fetching account summary: ${error.message}`);
    }
  }

  private convertToDTO(account: Account): AccountDto {
    return new AccountDto(
      account.id,
      account.accountName,
      account.accountNumber,
      account.currency.name,
      account.currency.symbol,
      account.bank.id,
      account.bank.name,
    );
  }
}
