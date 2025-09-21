import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from '../common/configurations/db.config';
import { AppConfigModule } from '../common/configurations/app.config';
import { AuthModule } from '../auth/auth.module';
import { BullmqConfigModule } from '../common/configurations/bullmq.config';

@Module({
  imports: [DbConfigModule, AppConfigModule, AuthModule, BullmqConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
