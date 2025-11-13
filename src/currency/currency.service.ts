import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './entities/currency.entity';
import { CurrencyDto } from './dto/currency.dto';
import logger from '../common/utils/logger/logger';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Currency) private readonly currencyRepository: Repository<Currency>,
  ) {}

  async getAllCurrencies(): Promise<CurrencyDto[]> {
    logger.info('Fetching all currencies from the database');

    const currencies = await this.currencyRepository.find();

    return currencies.map((c: Currency) => {
      return new CurrencyDto(c.id, c.code, c.name, c.symbol);
    });
  }
}
