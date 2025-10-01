import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { AccountDto } from './dto/account.dto';
import logger from '../common/utils/logger/logger';

@Injectable()
export class AccountService {
  constructor(@InjectRepository(Account) private readonly accountRepository: Repository<Account>) {}

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
