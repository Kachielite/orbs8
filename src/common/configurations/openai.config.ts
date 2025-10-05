import { Injectable, Module } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { envConstants } from '../constants/env.secrets';

@Injectable()
export class OpenAIConfig {
  private readonly llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      apiKey: envConstants.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      temperature: 0.7,
    });
  }

  getLLM(): ChatOpenAI {
    return this.llm;
  }
}

@Module({
  providers: [OpenAIConfig],
  exports: [OpenAIConfig],
})
export class OpenAIModule {}
