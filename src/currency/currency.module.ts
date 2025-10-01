import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Currency } from './entities/currency.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Currency])],
  controllers: [],
  providers: [],
})
export class CurrencyModule {}
