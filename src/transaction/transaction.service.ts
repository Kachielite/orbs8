import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, In, Repository } from 'typeorm';
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
import { TopTransactionDto, TransactionSummaryDto } from './dto/transaction-summary.dto';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

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
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async findAll(
    user: Partial<User>,
    query: GetTransactionQuery,
  ): Promise<PaginatedResponseDto<TransactionDto>> {
    const { page, limit, skip, take, order, search } = this.createPaginationParams(query);

    try {
      logger.info(`Fetching transactions for user: ${user.id}`);
      const where = {
        ...(search ? { description: ILike(`%${search}%`) } : {}),
        ...(query.categoryIds ? { category: { id: In(query.categoryIds) } } : {}),
        ...(query.startDate && query.endDate
          ? { transactionDate: Between(new Date(query.startDate), new Date(query.endDate)) }
          : {}),
        ...(query.bankIds ? { account: { bank: { id: In(query.bankIds) } } } : {}),
        ...(query.transactionType ? { type: query.transactionType } : {}),
        ...(query.accountIds ? { account: { id: In(query.accountIds) } } : {}),
        user: { id: user.id },
      };

      // if ordering by converted amount, we need to fetch all matching rows, convert amounts, then sort
      const orderField = order ? Object.keys(order)[0] : undefined;

      if (orderField === 'amount') {
        // Fetch all matching transactions so we can convert and sort by converted amount
        const [allTransactions, total] = await this.transactionRepository.findAndCount({
          where: where,
          relations: [
            'user',
            'currency',
            'category',
            'account',
            'account.bank',
            'account.currency',
          ],
        });

        const preferredCurrency = user.preferredCurrency || 'USD';
        const rateCache = new Map<string, number>();
        const allDtos = await Promise.all(
          allTransactions.map((transaction) =>
            this.convertToDto(transaction, preferredCurrency, rateCache),
          ),
        );

        // determine direction (ASC or DESC)
        const dirRaw = order ? Object.values(order)[0] : 'ASC';
        const dir = String(dirRaw).toLowerCase() === 'asc' ? 'asc' : 'desc';

        allDtos.sort((a, b) => (dir === 'asc' ? a.amount - b.amount : b.amount - a.amount));

        // slice for pagination
        const paged = allDtos.slice(skip, skip + take);
        const hasNext = skip + take < total;
        const hasPrevious = skip > 0;

        return new PaginatedResponseDto(paged, total, page, limit, hasNext, hasPrevious);
      }

      // default behavior: let the DB do paging and ordering for non-amount fields
      const [transactions, total] = await this.transactionRepository.findAndCount({
        where: where,
        relations: ['user', 'currency', 'category', 'account', 'account.bank', 'account.currency'],
        skip,
        take,
        order,
      });

      const hasNext = skip + take < total;
      const hasPrevious = skip > 0;

      const preferredCurrency = user.preferredCurrency || 'USD';
      const rateCache = new Map<string, number>();
      const transactionsDto = await Promise.all(
        transactions.map((transaction) =>
          this.convertToDto(transaction, preferredCurrency, rateCache),
        ),
      );

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
        relations: ['user', 'category', 'account', 'account.bank', 'account.currency', 'currency'],
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${id} not found for user ${user.id}`);
      }

      const preferredCurrency = user.preferredCurrency || 'USD';
      const rateCache = new Map<string, number>();
      return await this.convertToDto(transaction, preferredCurrency, rateCache);
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

  async getTransactionSummary(
    user: Partial<User>,
    startDate: string,
    endDate: string,
  ): Promise<TransactionSummaryDto> {
    try {
      logger.info(`Fetching transaction summary for user: ${user.id}`);

      const start = new Date(startDate);
      const end = new Date(endDate);
      const preferredCurrency = user.preferredCurrency || 'USD';

      // Fetch all debit transactions in the date range with needed relations
      const debitTxns = await this.transactionRepository.find({
        where: {
          user: { id: user.id },
          type: TransactionType.DEBIT,
          transactionDate: Between(start, end),
        },
        relations: ['currency', 'category', 'account', 'account.currency'],
      });

      // Convert each debit transaction to preferred currency and sum
      let totalSpend = 0;
      const spendByCategory = new Map<number, { name: string; amount: number }>();

      const rateCache = new Map<string, number>();
      for (const t of debitTxns) {
        const txCurrency = t.account?.currency?.code || t.currency?.code || preferredCurrency;
        const amount = Number(t.amount);
        let converted: number;
        if (txCurrency === preferredCurrency) {
          converted = amount;
        } else {
          const pairKey = `${txCurrency}${preferredCurrency}`;
          let rate = rateCache.get(pairKey);
          if (rate === undefined) {
            rate = await this.exchangeRateService.getRate(txCurrency, preferredCurrency);
            rateCache.set(pairKey, rate);
          }
          converted = amount * rate;
        }

        totalSpend += converted;

        const catId = t.category?.id;
        const catName = t.category?.name || 'Uncategorized';
        if (catId) {
          const prev = spendByCategory.get(catId) ?? { name: catName, amount: 0 };
          prev.amount += converted;
          spendByCategory.set(catId, prev);
        }
      }

      // Get top spend by category
      const topSpendByCategory = Array.from(spendByCategory.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4)
        .map((r) => new TopTransactionDto(r.name, Number(r.amount.toFixed(2))));

      // Fetch credit transactions and compute total income similarly
      const creditTxns = await this.transactionRepository.find({
        where: {
          user: { id: user.id },
          type: TransactionType.CREDIT,
          transactionDate: Between(start, end),
        },
        relations: ['currency', 'category', 'account', 'account.currency'],
      });

      let totalIncome = 0;
      const incomeByCategory = new Map<number, { name: string; amount: number }>();
      // reuse the same rateCache for credits
      for (const t of creditTxns) {
        const txCurrency = t.account?.currency?.code || t.currency?.code || preferredCurrency;
        const amount = Number(t.amount);
        let converted: number;
        if (txCurrency === preferredCurrency) {
          converted = amount;
        } else {
          const pairKey = `${txCurrency}${preferredCurrency}`;
          let rate = rateCache.get(pairKey);
          if (rate === undefined) {
            rate = await this.exchangeRateService.getRate(txCurrency, preferredCurrency);
            rateCache.set(pairKey, rate);
          }
          converted = amount * rate;
        }

        totalIncome += converted;

        const catId = t.category?.id;
        const catName = t.category?.name || 'Uncategorized';
        if (catId) {
          const prev = incomeByCategory.get(catId) ?? { name: catName, amount: 0 };
          prev.amount += converted;
          incomeByCategory.set(catId, prev);
        }
      }

      const topSpendByCreditType = Array.from(incomeByCategory.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4)
        .map((r) => new TopTransactionDto(r.name, Number(r.amount.toFixed(2))));

      const topSpendByDebitType = topSpendByCategory; // same as top spend by category for debits

      const totalTransactions = await this.transactionRepository.count({
        where: {
          user: { id: user.id },
          transactionDate: Between(start, end),
        },
      });

      const summaryDto = new TransactionSummaryDto();
      summaryDto.topSpendByCategory = topSpendByCategory;
      summaryDto.topSpendByCreditType = topSpendByCreditType;
      summaryDto.topSpendByDebitType = topSpendByDebitType;
      summaryDto.totalSpend = Number(totalSpend.toFixed(2));
      summaryDto.totalIncome = Number(totalIncome.toFixed(2));
      summaryDto.totalTransactions = totalTransactions;

      return summaryDto;
    } catch (error) {
      logger.error(`Error fetching transaction summary for user ${user.id}: ${error.message}`);
      throw new InternalServerErrorException(
        `Error fetching transaction summary for user ${user.id}: ${error.message}`,
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
          throw new NotFoundException(
            `Default currency USD not found in database. Please ensure currencies are properly seeded.`,
          );
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

    const paginationParams = paginationUtil<Transaction>({
      query: typedQuery,
      allowedSortFields: this.allowedSortFields,
      defaultSortField: 'createdAt' as keyof Transaction,
    });

    return {
      ...paginationParams,
      categoryIds: query.categoryIds,
      startDate: query.startDate,
      endDate: query.endDate,
      bankIds: query.bankIds,
      transactionType: query.transactionType,
      accountIds: query.accountIds,
    };
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

  private async convertToDto(
    transaction: Transaction,
    preferredCurrency = 'USD',
    rateCache = new Map<string, number>(),
  ): Promise<TransactionDto> {
    const txCurrency =
      transaction.account?.currency?.code || transaction.currency?.code || preferredCurrency;
    const amount = Number(transaction.amount);
    let convertedAmount = amount;
    if (txCurrency !== preferredCurrency) {
      const pairKey = `${txCurrency}${preferredCurrency}`;
      let rate = rateCache.get(pairKey);
      if (rate === undefined) {
        rate = await this.exchangeRateService.getRate(txCurrency, preferredCurrency);
        rateCache.set(pairKey, rate);
      }
      convertedAmount = amount * rate;
    }

    return new TransactionDto(
      transaction.id,
      transaction.transactionID,
      Number(convertedAmount.toFixed(2)),
      preferredCurrency,
      transaction.type,
      transaction.description,
      transaction.transactionDate,
      transaction.category?.name || 'Uncategorized',
      transaction.category?.id || 0,
      transaction.account?.accountNumber || '',
      transaction.account?.id || 0,
      transaction.account?.bank?.name || '',
      transaction.account?.bank?.id || 0,
      transaction.createdAt,
    );
  }
}
