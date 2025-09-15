import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from '../common/configurations/db.config';
import { AppConfigModule } from '../common/configurations/app.config';

@Module({
  imports: [DbConfigModule, AppConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
