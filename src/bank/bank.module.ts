import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bank } from './entities/bank.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bank])],
  controllers: [],
  providers: [],
})
export class BankModule {}
