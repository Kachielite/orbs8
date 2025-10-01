import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from '../common/configurations/db.config';
import { AppConfigModule } from '../common/configurations/app.config';
import { AuthModule } from '../auth/auth.module';
import { BullmqConfigModule } from '../common/configurations/bullmq.config';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from '../email/email.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MailConfigModule } from '../common/configurations/mail.config';
import { CategoryModule } from '../category/category.module';
import { AccountModule } from '../account/account.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    DbConfigModule,
    AppConfigModule,
    AuthModule,
    BullmqConfigModule,
    ScheduleModule.forRoot(),
    EmailModule,
    SubscriptionsModule,
    MailConfigModule,
    CategoryModule,
    AccountModule,
    TransactionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
