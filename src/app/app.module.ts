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

@Module({
  imports: [
    DbConfigModule,
    AppConfigModule,
    AuthModule,
    BullmqConfigModule,
    ScheduleModule.forRoot(),
    EmailModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
