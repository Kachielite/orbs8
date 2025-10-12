import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Transaction, TransactionType } from './entities/transaction.entity';
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
import { InteropZodType } from '@langchain/core/utils/types';
import { Currency } from '../currency/entities/currency.entity';
import { Bank } from '../bank/entities/bank.entity';
import { Account } from '../account/entities/account.entity';
import { CategoryService } from '../category/category.service';

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
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Currency) private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Bank) private readonly bankRepository: Repository<Bank>,
    @InjectRepository(Account) private readonly accountRepository: Repository<Account>,
    private readonly openAI: OpenAIConfig,
    private readonly categoryService: CategoryService,
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
        relations: ['user', 'currency', 'category', 'account', 'account.bank'],
        skip,
        take,
        order,
      });

      const hasNext = skip + take < total;
      const hasPrevious = skip > 0;
      const transactionsDto = transactions.map((transaction) => this.convertToDto(transaction));

      return new PaginatedResponseDto(transactionsDto, total, page, limit, hasNext, hasPrevious);
    } catch (error) {
      logger.error(`Error fetching transactions: ${error}`);
      throw new InternalServerErrorException(`Error fetching transactions: ${error.message}`);
    }
  }

  async findOne(id: number, user: Partial<User>): Promise<TransactionDto> {
    try {
      logger.info(`Fetching transaction with ID: ${id}`);
      const transaction = await this.transactionRepository.findOne({
        where: { id, user: { id: user.id } },
        relations: ['user', 'category', 'account', 'account.bank', 'currency'],
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
        relations: ['user', 'category', 'account', 'account.bank', 'currency'],
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

  async create(user: Partial<User>, emailText: string): Promise<GeneralResponseDto> {
    try {
      logger.info(`Creating transaction for user: ${user.id}`);

      // Extract transaction details from the email
      const transactionDetails = await this.extractTransactionDetails(emailText);
      const {
        type,
        amount,
        currency,
        date,
        description,
        currentBalance,
        transactionId,
        accountNumber,
        accountName,
        bankName,
      } = transactionDetails;

      console.log("transactionDetails: ", transactionDetails)

      // Find user
      const requestOwner = await this.userRepository.findOne({ where: { id: user.id } });
      if (!requestOwner) throw new NotFoundException(`User with ID ${user.id} not found`);

      // find existing transaction
      const tranID = transactionId || new Date(date).toISOString();
      const existingTransaction = await this.transactionRepository.findOne({
        where: {
          transactionID: tranID,
          user: { id: user.id },
          account: { accountName: accountName, accountNumber: accountNumber },
        },
      });
      if (existingTransaction) {
        return new GeneralResponseDto('Transaction already exists, skipping creation');
      }

      // Find currency from pre-populated list (search by both code and name)
      const currencySearch = currency?.toUpperCase() || 'USD';
      let currencyEntity = await this.currencyRepository
        .createQueryBuilder('currency')
        .where('UPPER(currency.code) = :search', { search: currencySearch })
        .orWhere('UPPER(currency.name) LIKE :searchLike', { searchLike: `%${currencySearch}%` })
        .getOne();

      if (!currencyEntity) {
        logger.warn(`Currency '${currencySearch}' not found. Defaulting to USD.`);
        currencyEntity = await this.currencyRepository.findOne({
          where: { code: 'USD' },
        });
        if (!currencyEntity) {
          throw new NotFoundException(`Default currency USD not found in database. Please ensure currencies are properly seeded.`);
        }
      }

      // Find bank
      let bankEntity: Bank | null;
      const bank = await this.bankRepository.findOne({
        where: { name: bankName },
      });
      if (!bank) {
        const newBank = this.bankRepository.create({ name: bankName });
        bankEntity = await this.bankRepository.save(newBank);
      } else {
        bankEntity = bank;
      }

      // Find Account
      let accountEntity: Account | null;
      const account = await this.accountRepository.findOne({
        where: { accountNumber, accountName, user: { id: user.id } },
      });
      if (!account) {
        const newAccount = this.accountRepository.create({
          accountName,
          accountNumber,
          currentBalance,
          user: requestOwner,
          bank: bankEntity,
          currency: currencyEntity,
        });
        accountEntity = await this.accountRepository.save(newAccount);
      } else {
        accountEntity = account;
      }

      // Find category
      const category = await this.categoryService.classifyTransaction({ description });
      const categoryEntity = await this.categoryRepository.findOne({
        where: { id: category.id },
      });

      // Create transaction
      const newTransaction = this.transactionRepository.create({
        amount,
        type:
          TransactionType[type.toUpperCase() as keyof typeof TransactionType] ||
          TransactionType.OTHER,
        description,
        transactionDate: new Date(date),
        transactionID: tranID,
        user: requestOwner,
        category: categoryEntity!,
        account: accountEntity,
        currency: currencyEntity,
      });
      await this.transactionRepository.save(newTransaction);

      return new GeneralResponseDto(`Transaction created successfully`);
    } catch (error) {
      logger.error(`Error creating transaction for user ${user.id}: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error creating transaction for user ${user.id}: ${error.message}`,
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
        relations: ['user', 'category', 'account', 'account.bank', 'currency'],
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
      <InteropZodType>(<unknown>this.transactionDetailsSchema),
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
      transaction.currency.code,
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
