import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from '../common/configurations/db.config';

@Module({
  imports: [DbConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
