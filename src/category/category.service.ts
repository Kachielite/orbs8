/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategoryDto } from './dto/category.dto';
import logger from '../common/utils/logger/logger';
import { envConstants } from '../common/constants/env.secrets';
import { EmbeddingConfig } from '../common/embedding/embedding.config';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { OpenAIConfig } from '../common/configurations/openai.config';
import { LangSmithService } from '../langsmith/langsmith.service';

@Injectable()
export class CategoryService {
  private readonly store: PGVectorStore;
  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    private readonly embeddings: EmbeddingConfig,
    private readonly openAI: OpenAIConfig,
    private readonly langSmithService: LangSmithService,
  ) {
    this.store = new PGVectorStore(this.embeddings.getEmbeddings(), {
      postgresConnectionOptions: { connectionString: process.env.DATABASE_URL },
      tableName: 'category',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'description',
      },
    });
  }

  async findAll(search?: string): Promise<CategoryDto[]> {
    try {
      logger.info(`Fetching list of categories with search term: ${search}`);
      const categories = await this.categoryRepository.find({
        where: search ? { name: ILike(`%${search}%`) } : {},
        order: {
          name: 'ASC',
        },
      });
      logger.info(`Fetched ${categories.length} categories`);
      return categories.map((category) => this.convertToDto(category));
    } catch (error) {
      logger.error(`Error fetching categories: ${(error as Error).message}`);
      throw new InternalServerErrorException(
        `Error fetching categories: ${(error as Error).message}`,
      );
    }
  }

  async findOne(id: number): Promise<CategoryDto> {
    try {
      logger.info(`Fetching category with ID: ${id}`);
      const category = await this.categoryRepository.findOne({
        where: {
          id,
        },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return this.convertToDto(category);
    } catch (error) {
      logger.error(`Error fetching category with ID: ${id}: ${(error as Error).message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error fetching category with ID: ${id}: ${(error as Error).message}`,
      );
    }
  }

  async ensureEmbeddings() {
    const forceReembed = envConstants.FORCE_REEMBED;
    const categories = await this.categoryRepository.find();

    for (const cat of categories) {
      const text = `${cat.name}: ${cat.description}`;

      if (!forceReembed && cat.embedding && cat.lastEmbeddingText === text) {
        logger.info(`Skipping category: ${cat.name} (no change)`);
      } else {
        const [embedding] = await this.embeddings.getEmbeddings().embedDocuments([text]);

        await this.categoryRepository.update(cat.id, {
          embedding,
          lastEmbeddingText: text,
        });

        logger.info(
          forceReembed
            ? `♻️ Re-embedded category: ${cat.name}`
            : `✅ Updated embedding for category: ${cat.name}`,
        );
      }
    }
  }

  async classifyTransaction(description: string) {
    const k = 3;
    const threshold = 0.6;
    logger.info(`Classifying transaction: ${description}`);
    try {
      logger.info(`Fetching top-k from vector DB`);
      const results = await this.store.similaritySearchWithScore(description, k);

      // Filter results based on a similarity threshold
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const filteredResults = results.filter(([_, score]) => score >= threshold);

      const candidates = filteredResults.map(([doc, score]) => ({
        id: doc.metadata?.id,
        name: doc.metadata?.name,
        description: doc.pageContent,
        type: doc.metadata?.type,
        score,
      }));

      logger.info(`Found ${candidates.length} candidates for "${description}"`);

      if (!candidates.length) {
        logger.info('No candidates found, returning Uncategorized');
        return await this.getUncategorized();
      }

      const candidateList = candidates
        .map((c, i) => `${i + 1}. ${c.name} (score: ${c.score.toFixed(2)}) - ${c.description}`)
        .join('\n');

      const prompt = `
                You are a financial transaction classifier.
                Transaction: "${description}"

                Candidates:
                ${candidateList}

                Instructions:
                1. Pick the single best matching category NAME from the candidates
                2. If no candidate has a good semantic match, return "Uncategorized"
                3. Return the exact category name only, no explanations
              `.trim();

      const response = await this.openAI.getLLM().invoke(prompt);
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const pickedName = response.content.toString().trim();

      logger.info(`LLM picked category: "${pickedName}" for "${description}"`);

      const bestCategory = await this.categoryRepository.findOne({
        where: { name: pickedName },
      });

      if (!bestCategory) {
        logger.warn(`Category "${pickedName}" not found in database`);
        return await this.getUncategorized();
      }

      return bestCategory;
    } catch (error) {
      logger.error(`Error fetching top-k from vector DB: ${error.message}`);
      throw new InternalServerErrorException(
        `Error fetching top-k from vector DB: ${error.message}`,
      );
    }
  }

  private async getUncategorized(): Promise<Category> {
    const unCategorizedCategory = await this.categoryRepository.findOne({
      where: {
        name: 'Uncategorized',
      },
    });

    if (!unCategorizedCategory) {
      throw new NotFoundException('Uncategorized category not found');
    }

    return unCategorizedCategory;
  }

  private convertToDto(category: Category): CategoryDto {
    return new CategoryDto(category.id, category.name, category.description, category.icon);
  }
}
