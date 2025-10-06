import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { OpenAIConfig } from '../common/configurations/openai.config';
import { CategoryFeedback } from './entities/category-feedback.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, CategoryFeedback, Transaction, User])],
  controllers: [CategoryController],
  providers: [CategoryService, OpenAIConfig],
})
export class CategoryModule {}
