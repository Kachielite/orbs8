import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Token } from '../tokens/entities/token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Token])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
