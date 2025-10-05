/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions, ILike, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategoryDto } from './dto/category.dto';
import logger from '../common/utils/logger/logger';
import { OpenAIConfig } from '../common/configurations/openai.config';
import { Document } from '@langchain/core/documents';
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { envConstants } from '../common/constants/env.secrets';
import crypto from 'crypto';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';

@Injectable()
export class CategoryService {
  private readonly dbOptions: DataSourceOptions;

  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    private readonly openAI: OpenAIConfig,
  ) {
    this.dbOptions = {
      type: envConstants.DB_TYPE as string,
      host: envConstants.DB_HOST,
      port: parseInt(envConstants.DB_PORT as string),
      username: envConstants.DB_USERNAME,
      password: envConstants.DB_PASSWORD,
      database: envConstants.DB_NAME,
    } as DataSourceOptions;
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

  async classifyTransaction(description: string): Promise<CategoryDto> {
    try {
      const docs = await this.loadDCategories();
      const retriever = await this.getRetriever(docs);
      const llm = this.openAI.getLLM();
      const prompt = this.getPrompt();

      const documentChain = await createStuffDocumentsChain({
        llm,
        prompt,
      });

      const retrievalChain = await createRetrievalChain({
        retriever,
        combineDocsChain: documentChain,
      });

      const response = await retrievalChain.invoke({
        input: description,
      });
      const prospectCategory = (() => {
        try {
          return JSON.parse(response.answer);
        } catch (err) {
          logger.error('Failed to parse classifier response', (err as Error).message);
          throw new BadRequestException('Invalid classifier response');
        }
      })();
      logger.info(`Prospective category: ${JSON.stringify(prospectCategory)}`);

      const categoryName = prospectCategory?.name;
      if (!categoryName) {
        throw new BadRequestException('Classifier did not return a category name');
      }

      const category = await this.categoryRepository.findOne({
        where: { name: ILike(`${categoryName}`) }, // case-insensitive match
      });

      if (!category) {
        throw new BadRequestException(`Category ${prospectCategory.answer.name} not found`);
      }

      return this.convertToDto(category);
    } catch (error) {
      logger.error(`Error classifying transaction: ${(error as Error).message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error classifying transaction: ${(error as Error).message}`,
      );
    }
  }

  private async loadDCategories() {
    try {
      const categories = await this.categoryRepository.find();

      const docs = categories.map((category) => {
        // full JSON as a string for embedding
        const content = JSON.stringify(category, null, 2);

        return new Document({
          pageContent: content,
          metadata: {
            name: category.name,
            type: category.type,
            regex: category.regex,
          },
        });
      });

      console.info(`✅ Transformed ${docs.length} category documents for embedding`);
      return docs;
    } catch (error) {
      logger.error(`Error loading categories: ${error.message}`);
      throw new InternalServerErrorException(
        `Error loading categories: ${(error as Error).message}`,
      );
    }
  }

  private computeHash(data: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private async getRetriever(docs: Document[]) {
    // Step 1: Initialize TypeORM data source
    const dataSource = new DataSource(this.dbOptions);
    await dataSource.initialize();

    // Step 2: Initialize vector store with an explicit config object (typed)
    const vectorStore = await TypeORMVectorStore.fromDataSource(new OpenAIEmbeddings(), {
      postgresConnectionOptions: this.dbOptions, // ✅ satisfies type definition
      tableName: 'langchain_pg_embedding', // optional, explicit naming
    });

    // Step 3: Ensure the embedding table exists
    await vectorStore.ensureTableInDatabase();

    // Step 4: Create a metadata table if missing (for hash tracking)
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS vector_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Step 5: Compute hash of current docs
    const currentHash = this.computeHash(docs.map((d) => d.pageContent));

    // Step 6: Fetch stored hash (if any)
    const existingHashResult = await dataSource.query(
      `SELECT value FROM vector_metadata WHERE key = 'categories_hash' LIMIT 1;`,
    );
    const storedHash = existingHashResult?.[0]?.value ?? null;

    // Step 7: Check if the embedding table exists and has data
    const tableExistsResult = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'langchain_pg_embedding'
      );
    `);
    const tableExists = tableExistsResult?.[0]?.exists || false;

    let existingCount = 0;
    if (tableExists) {
      const countResult = await dataSource.query(`SELECT COUNT(*) FROM langchain_pg_embedding;`);
      existingCount = parseInt(countResult?.[0]?.count || '0', 10);
    }

    // Step 8: Determine if embeddings need refresh
    const needsEmbedding =
      !tableExists || !existingCount || !storedHash || storedHash !== currentHash;

    if (needsEmbedding) {
      logger.info('🧠 Updating vector embeddings...');

      if (tableExists) {
        await dataSource.query(`DROP TABLE IF EXISTS langchain_pg_embedding;`);
        logger.info('🧹 Old embeddings cleared');
      }

      await vectorStore.ensureTableInDatabase();
      await vectorStore.addDocuments(docs);
      logger.info('✅ New embeddings added');

      // Save or update new hash
      await dataSource.query(
        `
        INSERT INTO vector_metadata (key, value)
        VALUES ('categories_hash', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
      `,
        [currentHash],
      );
    } else {
      logger.info('✅ Embeddings unchanged — skipping re-embedding');
    }

    await dataSource.destroy();

    // Step 9: Return retriever
    return vectorStore.asRetriever();
  }

  private convertToDto(category: Category): CategoryDto {
    return new CategoryDto(category.id, category.name, category.description, category.icon);
  }

  private getPrompt() {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a financial transaction classifier.
      
      You will receive:
      1. A payment description.
      2. A list of category objects in JSON format (the "context"). Each object has:
         - name
         - description
         - icon
         - type
         - regex
      
      Your goal is to choose **exactly one** category object from this provided list that best matches the payment description.
      
      ### CRITICAL RULES:
      1. You MUST copy the chosen object **verbatim** from the provided context.
      2. DO NOT create, modify, paraphrase, rename, or invent any category.
      3. DO NOT remove or alter any field values.
      
      ### CLASSIFICATION LOGIC:
      1. First, attempt to match the payment description using the "regex" field of each category (case-insensitive).
      2. If multiple regex patterns match, choose the one with the **longest** pattern (most specific).
      3. If no regex match is found:
         - Check if the payment description contains **human names** — multiple capitalized words like "JOHN DOE" or "EMILY CARTER".
         - If it looks like a personal name or includes sender/receiver details, classify it as **"Peer-to-Peer Transfer"** if that category exists.
      4. If no suitable category is found, return the one named **"Uncategorized"**.
      
      ### OUTPUT FORMAT:
      - Return ONLY a single JSON object (not an array).
      - Include only the keys: name, description, icon, type.
      - No markdown, no explanations, no extra text.
      
      ### EXAMPLE:
      Payment description: "RVSL/WEB PYMT JETBRAINS PRAGUE CZ/VSH/(29-"
      Context includes:
      {{
        "name": "Subscriptions",
        "description": "Recurring payments to digital services like music, video streaming, SaaS tools, or online memberships.",
        "icon": "📺",
        "type": "expense",
        "regex": "(SPOTIFY|NETFLIX|APPLE|MICROSOFT|GOOGLE|YOUTUBE|DISNEY|SUBSCRIPTION|PLAN|PREMIUM)"
      }}
      
      Expected Output:
      {{
        "name": "Subscriptions",
        "description": "Recurring payments to digital services like music, video streaming, SaaS tools, or online memberships.",
        "icon": "📺",
        "type": "expense"
      }}`,
      ],
      [
        'human',
        `Payment description: "{input}"
      
      Retrieved context:
      {context}
      
      Return exactly ONE object copied verbatim from the context.
      If unsure, return the one whose "name" is "Uncategorized".`,
      ],
    ]);
  }
}
