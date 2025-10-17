import { GetQuery } from '../../common/interfaces/query.interface';
import { Transaction, TransactionType } from '../entities/transaction.entity';

export type TransactionSortField = 'id' | 'amount' | 'type' | 'transactionDate' | 'createdAt';

export interface GetTransactionQuery extends GetQuery<Transaction> {
  categoryIds?: number[];
  startDate?: string;
  endDate?: string;
  bankIds?: number[];
  transactionType?: TransactionType;
  accountIds?: number[];
}
