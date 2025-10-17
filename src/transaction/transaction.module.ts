import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { Transaction } from './entities/transaction.entity';
import { CategoryFeedback } from '../category/entities/category-feedback.entity';
import { OpenAIConfig } from '../common/configurations/openai.config';
import { Currency } from '../currency/entities/currency.entity';
import { Bank } from '../bank/entities/bank.entity';
import { Account } from '../account/entities/account.entity';
import { CategoryService } from '../category/category.service';
import { User } from '../auth/entities/user.entity';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Category,
      CategoryFeedback,
      Currency,
      Bank,
      Account,
      User,
    ]),
    ExchangeRateModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService, OpenAIConfig, CategoryService],
  exports: [TransactionService],
})
export class TransactionModule {}
