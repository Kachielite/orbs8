import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './entities/email.entity';
import { EmailWorker } from './email.worker';
import { User } from '../auth/entities/user.entity';
import { BullModule } from '@nestjs/bullmq';
import { TransactionService } from '../transaction/transaction.service';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Category } from '../category/entities/category.entity';
import { CategoryFeedback } from '../category/entities/category-feedback.entity';
import { Bank } from '../bank/entities/bank.entity';
import { Account } from '../account/entities/account.entity';
import { Currency } from '../currency/entities/currency.entity';
import { OpenAIConfig } from '../common/configurations/openai.config';
import { CategoryService } from '../category/category.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Email,
      User,
      Transaction,
      Category,
      CategoryFeedback,
      Bank,
      Account,
      Currency,
    ]),
    BullModule.registerQueue({ name: 'email-sync' }),
  ],
  controllers: [EmailController],
  providers: [EmailService, EmailWorker, TransactionService, OpenAIConfig, CategoryService],
  exports: [EmailService],
})
export class EmailModule {}
