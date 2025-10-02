import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { envConstants } from '../constants/env.secrets';

@Injectable()
export class EmbeddingConfig {
  private readonly embeddings = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    openAIApiKey: envConstants.OPENAI_API_KEY,
  });

  public async embedText(text: string) {
    return this.embeddings.embedQuery(text);
  }

  public getEmbeddings(): OpenAIEmbeddings {
    return this.embeddings;
  }
}
