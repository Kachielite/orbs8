import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './entities/email.entity';
import { EmailWorker } from './email.worker';
import { User } from '../auth/entities/user.entity';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([Email]),
    TypeOrmModule.forFeature([User]),
    BullModule.registerQueue({ name: 'email-sync' }),
  ],
  controllers: [EmailController],
  providers: [EmailService, EmailWorker],
  exports: [EmailService],
})
export class EmailModule {}
