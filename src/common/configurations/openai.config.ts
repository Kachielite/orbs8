import { OpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { LangSmithService } from '../../langsmith/langsmith.service';

@Injectable()
export class OpenAIConfig {
  private readonly llm: OpenAI;

  constructor(private langSmithService: LangSmithService) {
    this.llm = new OpenAI({
      temperature: 0.7,
      model: 'gpt-3.5-turbo',
    });
  }

  getLLM(): OpenAI {
    return this.llm;
  }
}
