import { GetQuery } from '../../common/interfaces/query.interface';
import { Transaction } from '../entities/transaction.entity';

export type TransactionSortField = 'id' | 'amount' | 'type' | 'transactionDate' | 'createdAt';

export interface GetTransactionQuery extends GetQuery<Transaction> {}
