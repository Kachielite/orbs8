import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Transaction } from './entities/transaction.entity';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { TransactionDto } from './dto/transaction.dto';
import { GetTransactionQuery } from './interface/transaction-query.interface';
import logger from '../common/utils/logger/logger';
import { Category } from '../category/entities/category.entity';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { paginationUtil } from '../common/utils/pagination.util';
import { CategoryFeedback } from '../category/entities/category-feedback.entity';
import { OpenAIConfig } from '../common/configurations/openai.config';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z, type ZodTypeAny } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { TransactionDetails } from './interface/transaction-details.interface';

@Injectable()
export class TransactionService {
  // Validate and normalize sort/order
  private allowedSortFields: Array<keyof Transaction> = [
    'id',
    'amount',
    'type',
    'transactionDate',
    'createdAt',
  ];

  private transactionDetailsSchema: ZodTypeAny = z.object({
    type: z.enum(['Credit', 'Debit']).describe('Transaction type'),
    amount: z.number().describe('Transaction amount'),
    currency: z.string().describe('Transaction currency'),
    date: z.string().describe('Transaction date in YYYY-MM-DD format'),
    description: z.string().describe('Transaction description'),
    currentBalance: z.number().describe('Current account balance'),
    transactionId: z.string().describe('Transaction ID'),
    accountNumber: z.string().describe('Account number'),
    accountName: z.string().describe("Account name, this could also be the recipient's name"),
    bankName: z.string().describe('Bank name'),
  });

  constructor(
    @InjectRepository(Transaction) private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CategoryFeedback)
    private readonly categoryFeedbackRepository: Repository<CategoryFeedback>,
    private readonly openAI: OpenAIConfig,
  ) {}

  async findAll(
    user: Partial<User>,
    query: GetTransactionQuery,
  ): Promise<PaginatedResponseDto<TransactionDto>> {
    const { page, limit, skip, take, order, search } = this.createPaginationParams(query);

    try {
      logger.info(`Fetching transactions for user: ${user.id}`);
      const [transactions, total] = await this.transactionRepository.findAndCount({
        where: {
          ...(search ? { description: search } : {}),
          user: { id: user.id },
        },
        relations: ['user'],
        skip,
        take,
        order,
      });

      const hasNext = skip + take < total;
      const hasPrevious = skip > 0;
      const transactionsDto = transactions.map((transaction) => this.convertToDto(transaction));

      return new PaginatedResponseDto(transactionsDto, total, page, limit, hasNext, hasPrevious);
    } catch (error) {
      logger.error(`Error fetching transactions: ${error.message}`);
      throw new InternalServerErrorException(`Error fetching transactions: ${error.message}`);
    }
  }

  async findOne(id: number, user: Partial<User>): Promise<TransactionDto> {
    try {
      logger.info(`Fetching transaction with ID: ${id}`);
      const transaction = await this.transactionRepository.findOne({
        where: { id, user: { id: user.id } },
        relations: ['user', 'category', 'account', 'currency', 'bank'],
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${id} not found for user ${user.id}`);
      }

      return this.convertToDto(transaction);
    } catch (error) {
      logger.error(`Error fetching transaction with ID: ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error fetching transaction with ID: ${id}: ${error.message}`,
      );
    }
  }

  async findAllByAccount(
    accountId: number,
    query: GetTransactionQuery,
    user: Partial<User>,
  ): Promise<PaginatedResponseDto<TransactionDto>> {
    const { page, limit, skip, take, order, search } = this.createPaginationParams(query);

    try {
      logger.info(`Fetching transactions for account: ${accountId}`);
      const [transactions, total] = await this.transactionRepository.findAndCount({
        where: {
          ...(search ? { description: search } : {}),
          account: { id: accountId, user: { id: user.id } },
        },
        relations: ['user', 'category', 'account', 'currency', 'bank'],
        skip,
        take,
        order,
      });

      const hasNext = skip + take < total;
      const hasPrevious = skip > 0;
      const transactionsDto = transactions.map((transaction) => this.convertToDto(transaction));

      return new PaginatedResponseDto(transactionsDto, total, page, limit, hasNext, hasPrevious);
    } catch (error) {
      logger.error(`Error fetching transactions for account ${accountId}: ${error.message}`);
      throw new InternalServerErrorException(
        `Error fetching transactions for account ${accountId}: ${error.message}`,
      );
    }
  }

  async update(
    id: number,
    user: Partial<User>,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<GeneralResponseDto> {
    const { categoryId, commonName, applyToAll } = updateTransactionDto;

    try {
      logger.info(`Updating transaction with ID: ${id}`);
      const transaction = await this.transactionRepository.findOne({
        where: { id, user: { id: user.id } },
        relations: ['user', 'category', 'account', 'currency', 'bank'],
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${id} not found for user ${user.id}`);
      }

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      await this.transactionRepository.update(id, {
        category: category,
      });

      if (commonName) {
        // Update regex
        category.regex = this.appendToRegex(category.regex, commonName);
        await this.categoryRepository.save(category);
      }

      if (applyToAll) {
        if (commonName) {
          // Create feedback for all transactions with the same category
          const feedback = this.categoryFeedbackRepository.create({
            commonName,
            category,
            user: transaction.user,
            appliedToAll: true,
          });
          await this.categoryFeedbackRepository.save(feedback);
        }

        // update all transactions with the same category
        await this.transactionRepository
          .createQueryBuilder()
          .update(Transaction)
          .set({ category })
          .where('description ILIKE :pattern', { pattern: `%${commonName}%` })
          .execute();
      }

      return new GeneralResponseDto('Transaction updated successfully');
    } catch (error) {
      logger.error(`Error updating transaction with ID: ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error updating transaction with ID: ${id}: ${error.message}`,
      );
    }
  }

  private createPaginationParams(query: GetTransactionQuery) {
    // Create a properly typed query object that matches the pagination utility's expectations
    const typedQuery = {
      page: query.page,
      limit: query.limit,
      search: query.search,
      sort: query.sort as keyof Transaction,
      order: query.order,
    };

    return paginationUtil<Transaction>({
      query: typedQuery,
      allowedSortFields: this.allowedSortFields,
      defaultSortField: 'createdAt' as keyof Transaction,
    });
  }

  private appendToRegex(oldRegex: string | null, newTerm: string): string {
    const clean = newTerm
      .trim()
      .toUpperCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (!oldRegex) return `(${clean})`;

    const inner = oldRegex.replace(/^\(|\)$/g, '');
    const tokens = inner.split('|').map((t) => t.trim());

    if (!tokens.includes(clean)) tokens.push(clean);

    const updated = `(${tokens.join('|')})`;

    // Validate
    new RegExp(updated, 'i');
    return updated;
  }

  private async extractTransactionDetails(emailText: string): Promise<TransactionDetails> {
    const outputParser = StructuredOutputParser.fromZodSchema(
      <InteropZodType>this.transactionDetailsSchema,
    );

    const prompt = ChatPromptTemplate.fromTemplate(`
        You are a financial data extraction assistant. Extract the transaction details from the email below.
        
        {format_instructions}
        
        Email content:
        """
        {emailText}
        """
          `);

    const llm = this.openAI.getLLM();
    const chain = prompt.pipe(llm).pipe(outputParser);

    return (await chain.invoke({
      emailText,
      format_instructions: outputParser.getFormatInstructions(),
    })) as TransactionDetails;
  }

  private convertToDto(transaction: Transaction): TransactionDto {
    return new TransactionDto(
      transaction.id,
      transaction.amount,
      transaction.currency.name,
      transaction.type,
      transaction.description,
      transaction.transactionDate,
      transaction.category.name,
      transaction.account.accountNumber,
      transaction.account.bank.name,
      transaction.createdAt,
    );
  }
}
