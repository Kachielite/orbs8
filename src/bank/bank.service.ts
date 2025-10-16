import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from './entities/bank.entity';
import { User } from '../auth/entities/user.entity';
import { BankDto } from './dto/bank.dto';
import logger from '../common/utils/logger/logger';

@Injectable()
export class BankService {
  constructor(@InjectRepository(Bank) private readonly bankRepository: Repository<Bank>) {}

  async getAllBanks(user: Partial<User>): Promise<BankDto[]> {
    try {
      logger.info(`Fetching banks for user: ${user.id}`);
      const banks = await this.bankRepository.find({
        where: { accounts: { user: { id: user.id } } },
        relations: ['accounts', 'accounts.user'],
      });
      return banks.map((bank) => new BankDto(bank.id, bank.name));
    } catch (error) {
      logger.error(`Error fetching banks for user ${user.id}: ${error.message}`);
      throw new InternalServerErrorException(
        `Error fetching banks for user ${user.id}: ${error.message}`,
      );
    }
  }

  async getBankById(id: number, user: Partial<User>): Promise<BankDto> {
    try {
      logger.info(`Fetching bank with ID: ${id} for user: ${user.id}`);
      const bank = await this.bankRepository.findOne({
        where: { id, accounts: { user: { id: user.id } } },
        relations: ['accounts', 'accounts.user'],
      });
      if (!bank) {
        throw new Error(`Bank with ID ${id} not found for user ${user.id}`);
      }
      return new BankDto(bank.id, bank.name);
    } catch (error) {
      logger.error(
        `Error fetching bank with ID: ${id} for user: ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        `Error fetching bank with ID: ${id} for user: ${user.id}`,
      );
    }
  }
}