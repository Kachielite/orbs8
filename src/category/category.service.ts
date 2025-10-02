import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategoryDto } from './dto/category.dto';
import logger from '../common/utils/logger/logger';
import { envConstants } from '../common/constants/env.secrets';
import { EmbeddingConfig } from '../common/embedding/embedding.config';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    private readonly embeddings: EmbeddingConfig,
  ) {}

  async findAll(search?: string): Promise<CategoryDto[]> {
    try {
      logger.info(`Fetching list of categories with search term: ${search}`);
      const categories = await this.categoryRepository.find({
        where: {
          name: search ? `%${search}%` : undefined,
        },
        order: {
          name: 'ASC',
        },
      });
      logger.info(`Fetched ${categories.length} categories`);
      return categories.map((category) => this.convertToDto(category));
    } catch (error) {
      logger.error(`Error fetching categories: ${error.message}`);
      throw new InternalServerErrorException(`Error fetching categories: ${error.message}`);
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
      logger.error(`Error fetching category with ID: ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error fetching category with ID: ${id}: ${error.message}`,
      );
    }
  }

  async ensureEmbeddings() {
    const forceReembed = envConstants.FORCE_REEMBED;
    const categories = await this.categoryRepository.find();

    for (const cat of categories) {
      const text = `${cat.name}: ${cat.description}`;

      if (forceReembed && cat.embedding && cat.lastEmbeddingText === text) {
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

  private convertToDto(category: Category): CategoryDto {
    return new CategoryDto(category.id, category.name, category.description, category.icon);
  }
}
