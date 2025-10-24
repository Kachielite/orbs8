import { forwardRef, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './entities/email.entity';
import { EmailWorker } from './email.worker';
import { User } from '../auth/entities/user.entity';
import { BullModule } from '@nestjs/bullmq';
import { TransactionModule } from '../transaction/transaction.module';
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
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // Register only entities used directly by EmailModule. TransactionModule
    // already registers Transaction and related entities and exports TransactionService.
    TypeOrmModule.forFeature([
      Email,
      User,
      Category,
      CategoryFeedback,
      Bank,
      Account,
      Currency,
      Notification,
    ]),
    TransactionModule,
    BullModule.registerQueue({ name: 'email-sync' }),
    forwardRef(() => NotificationModule),
    ScheduleModule.forRoot(),
  ],
  controllers: [EmailController],
  providers: [EmailService, EmailWorker, OpenAIConfig, CategoryService, EmailGateway],
  exports: [EmailService, EmailGateway],
})
export class EmailModule {}
