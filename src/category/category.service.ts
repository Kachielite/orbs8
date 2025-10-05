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

@Injectable()
export class CategoryService {
  private readonly store: PGVectorStore;
  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    private readonly embeddings: EmbeddingConfig,
    private readonly openAI: OpenAIConfig,
  ) {
    const dbUrl = `postgresql://${envConstants.DB_USERNAME}:${envConstants.DB_PASSWORD}@${envConstants.DB_HOST}:${envConstants.DB_PORT}/${envConstants.DB_NAME}`;

    this.store = new PGVectorStore(this.embeddings.getEmbeddings(), {
      postgresConnectionOptions: { connectionString: dbUrl },
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

  async classifyTransaction(description: string) {}

  private convertToDto(category: Category): CategoryDto {
    return new CategoryDto(category.id, category.name, category.description, category.icon);
  }
}
