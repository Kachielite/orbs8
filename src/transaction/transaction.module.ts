import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { Transaction } from './entities/transaction.entity';
import { CategoryFeedback } from '../category/entities/category-feedback.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Category, CategoryFeedback])],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
