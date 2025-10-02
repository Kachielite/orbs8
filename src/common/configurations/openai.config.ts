import { Injectable, Module } from '@nestjs/common';
import { OpenAI } from '@langchain/openai';
import { envConstants } from '../constants/env.secrets';

@Injectable()
export class OpenAIConfig {
  private llm: OpenAI;

  constructor() {
    this.llm = new OpenAI({
      apiKey: envConstants.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
    });
  }

  getLLM(): OpenAI {
    return this.llm;
  }
}

@Module({
  providers: [OpenAIConfig],
  exports: [OpenAIConfig],
})
export class OpenAIModule {}
