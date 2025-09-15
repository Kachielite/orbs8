import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from '../common/configurations/db.config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DbConfigModule, ConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
