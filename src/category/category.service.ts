/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-return */
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, } from '@nestjs/common';
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
import { ClassifyTransactionDto } from './dto/classify-transaction.dto';

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

  async classifyTransaction(request: ClassifyTransactionDto): Promise<CategoryDto> {
    try {
      logger.info(`Classifying transaction: ${JSON.stringify(request)}`);
      const { description } = request;

      // 1) Deterministic regex-based classification first
      const allCategories = await this.categoryRepository.find();
      const regexMatch = this.matchCategoryByRegex(description, allCategories);
      if (regexMatch) {
        logger.info(`✅ Regex matched category: ${regexMatch.name}`);
        console.log(`Desc: ${description} | Category: ${regexMatch.name}`);
        return this.convertToDto(regexMatch);
      }

      // 2) Fallback to LLM + retrieval flow
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

      if (category) {
        console.log(`Desc: ${description} | Category: ${category.name}`);
        return this.convertToDto(category);
      }

      // If the LLM returns a name that's not in the DB, surface an error rather than forcing a fallback
      throw new BadRequestException(
        `Category '${categoryName}' from classifier not found in database`,
      );
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

  // Deterministic regex matcher: returns the longest-pattern match if multiple
  private matchCategoryByRegex(description: string, categories: Category[]): Category | null {
    if (!description) return null;
    const text = description.toString();

    const upperText = text.toUpperCase();
    const p2pStrong =
      /(IFO|TRANSFER|P2P|SEND|TRF\/\/FRM|BENEFICIARY|REVERSAL|REVSL|MOBILE\s?MONEY|PERSONAL\s?TRANSFER|PAYMENT\s?TO)/i.test(
        text,
      );

    // Extract potential brand tokens from the text (A-Z/0-9 words length >= 3)
    const textTokens = Array.from(new Set(upperText.match(/\b[A-Z0-9][A-Z0-9_-]{2,}\b/g) || []));
    const genericStops = new Set([
      'WEB',
      'PAYMENT',
      'PAYMT',
      'PYMT',
      'POS',
      'ONLINE',
      'STORE',
      'SHOP',
      'MERCHANT',
      'TO',
      'FROM',
      'ATM',
      'FEE',
      'CHARGE',
      'REV',
      'REVSL',
      'REVERSAL',
      'TRANSFER',
      'BENEFICIARY',
      'MONEY',
      'MOBILE',
      'PERSONAL',
      'PAYMENTTO',
      'PAYMENTFROM',
      'BRANCH',
      'KE',
      'NG',
      'GH',
      'TZ',
      'NAIROBI',
      'LAGOS',
    ]);

    type ScoredMatch = { cat: Category; score: number };
    const scoredMatches: ScoredMatch[] = [];

    for (const cat of categories) {
      const rawPattern = cat.regex?.trim();
      if (!rawPattern) continue;
      const pattern = rawPattern.includes('\\') ? rawPattern.replace(/\\\\/g, '\\') : rawPattern;
      try {
        const re = new RegExp(pattern, 'i');
        const m = re.exec(text);
        if (!m) continue;

        const matched = m[0] ?? '';

        // Tokenize pattern into candidate brand tokens (uppercase words >=3)
        const patternTokens = Array.from(
          new Set((pattern.toUpperCase().match(/[A-Z0-9]{3,}/g) || []).map((t) => t)),
        ).filter((t) => !genericStops.has(t));

        // Overlap between text tokens and pattern tokens, excluding generics
        const overlap = new Set(
          textTokens
            .map((t) => t.replace(/[^A-Z0-9]/g, ''))
            .filter((t) => t.length >= 3 && !genericStops.has(t) && patternTokens.includes(t)),
        );

        // Scoring components
        // 1) Overlap weight (dominant)
        let score = overlap.size * 12;

        // 2) Special boost for standout brands
        if (overlap.has('GLOVO')) score += 8;
        if (overlap.has('UBEREATS') || overlap.has('UBEREAT')) score += 6;

        // 3) Small weight for matched substring length
        score += Math.min(20, matched.length) / 4; // 0..5

        // Penalize P2P catch-all when no strong P2P keywords present
        const isP2P = cat.name.toLowerCase() === 'peer-to-peer transfer';
        if (isP2P && !p2pStrong) {
          score -= 1000; // effectively ignore unless it's the only match
        }

        scoredMatches.push({ cat, score });
      } catch (err) {
        logger.warn(
          `Invalid regex for category '${cat.name}': ${rawPattern}. Error: ${(err as Error).message}`,
        );
      }
    }

    if (!scoredMatches.length) return null;

    // Prefer highest score; if tie/near-tie, defer to LLM to disambiguate
    scoredMatches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aPat = (a.cat.regex || '').length;
      const bPat = (b.cat.regex || '').length;
      if (bPat !== aPat) return bPat - aPat;
      return a.cat.name.localeCompare(b.cat.name);
    });

    const top = scoredMatches[0];
    const runnerUp = scoredMatches[1];
    if (
      runnerUp &&
      // near-tie threshold
      Math.abs(top.score - runnerUp.score) <= 3 &&
      top.cat.name.toLowerCase() !== 'peer-to-peer transfer' &&
      runnerUp.cat.name.toLowerCase() !== 'peer-to-peer transfer'
    ) {
      // let LLM decide between very similar matches (e.g., Groceries vs Dining)
      return null;
    }

    return top.cat;
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
         - Choose the single best match from the provided categories using the retrieved context.
         - If unsure, return the one whose name is "Uncategorized".
      
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
