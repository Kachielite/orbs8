import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Account } from './entities/account.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';

@Module({
  imports: [TypeOrmModule.forFeature([Account, User, Transaction]), ExchangeRateModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
