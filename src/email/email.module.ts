import { Module, forwardRef } from '@nestjs/common';
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
import { EmailGateway } from './email.gateway';
import { Notification } from '../notification/entities/notification.entity';
import { NotificationModule } from '../notification/notification.module';

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
      Notification,
    ]),
    BullModule.registerQueue({ name: 'email-sync' }),
    forwardRef(() => NotificationModule),
  ],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailWorker,
    TransactionService,
    OpenAIConfig,
    CategoryService,
    EmailGateway,
  ],
  exports: [EmailService, EmailGateway],
})
export class EmailModule {}
