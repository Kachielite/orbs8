import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegexService } from './regex.service';
import { Regex } from './entities/regex.entity';
import { Bank } from '../bank/entities/bank.entity';
import { OpenAIConfig } from '../common/configurations/openai.config';

@Module({
  imports: [TypeOrmModule.forFeature([Regex, Bank])],
  providers: [RegexService, OpenAIConfig],
  exports: [RegexService],
})
export class RegexModule {}
