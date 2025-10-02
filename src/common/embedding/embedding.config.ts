import { OpenAIEmbeddings } from '@langchain/openai';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import { envConstants } from '../constants/env.secrets';

@Injectable()
export class EmbeddingConfig {
  // Create a tracer for LangSmith
  private readonly tracer = new LangChainTracer({
    projectName: envConstants.LANGSMITH_PROJECT,
  });

  private readonly embeddings = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    apiKey: envConstants.OPENAI_API_KEY,
  });

  /**
   * Get the configured embeddings instance
   * @returns OpenAIEmbeddings instance with LangSmith tracing
   */
  public getEmbeddings(): OpenAIEmbeddings {
    return this.embeddings;
  }
}

// /**
//  * Generate embeddings for a single text
//  * @param text - Text to embed
//  * @returns Promise<number[]> - The embedding vector
//  */
// public async embedText(text: string): Promise<number[]> {
//   return await this.embeddings.embedQuery(text);
// }
//
// /**
//  * Generate embeddings for multiple texts
//  * @param texts - Array of texts to embed
//  * @returns Promise<number[][]> - Array of embedding vectors
//  */
// public async embedTexts(texts: string[]): Promise<number[][]> {
//   return await this.embeddings.embedDocuments(texts);
// }
