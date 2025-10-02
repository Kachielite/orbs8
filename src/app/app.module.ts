import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from '../common/configurations/db.config';
import { AppConfigModule } from '../common/configurations/app.config';
import { AuthModule } from '../auth/auth.module';
import { BullmqConfigModule } from '../common/configurations/bullmq.config';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from '../email/email.module';
import { MailConfigModule } from '../common/configurations/mail.config';
import { CategoryModule } from '../category/category.module';
import { AccountModule } from '../account/account.module';
import { TransactionModule } from '../transaction/transaction.module';
import { EmbeddingModule } from '../common/configurations/embedding.config';
import { LangSmithModule } from '../langsmith/langsmith.module';
import { OpenAIModule } from '../common/configurations/openai.config';

@Module({
  imports: [
    LangSmithModule,
    DbConfigModule,
    AppConfigModule,
    AuthModule,
    BullmqConfigModule,
    ScheduleModule.forRoot(),
    EmailModule,
    MailConfigModule,
    CategoryModule,
    AccountModule,
    TransactionModule,
    EmbeddingModule,
    OpenAIModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
