import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../entities/transaction.entity';

export class TransactionDto {
  @ApiProperty({ description: 'The id of the transaction', example: 1 })
  id: number;

  @ApiProperty({ description: 'The amount of the transaction', example: 100 })
  amount: number;

  @ApiProperty({ description: 'The date of the transaction', example: '2023-01-01' })
  currency: string;

  @ApiProperty({ description: 'The type of the transaction', example: 'credit' })
  type: TransactionType;

  @ApiProperty({ description: 'The description of the transaction', example: 'Salary' })
  description: string;

  @ApiProperty({ description: 'The date of the transaction', example: '2023-01-01' })
  transactionDate: Date;

  @ApiProperty({ description: 'The category of the transaction', example: 'Salary' })
  category: string;

  @ApiProperty({ description: 'The category of the transaction', example: 1 })
  categoryId: number;

  @ApiProperty({ description: 'The account of the transaction', example: 'Checking' })
  account: string;

  @ApiProperty({ description: 'The account of the transaction', example: 1 })
  accountId: number;

  @ApiProperty({ description: 'The bank of the transaction', example: 'Bank of America' })
  bank: string;

  @ApiProperty({ description: 'The bank of the transaction', example: 1 })
  bankId: number;

  @ApiProperty({ description: 'The date of the transaction', example: '2023-01-01' })
  createdAt: Date;

  constructor(
    id: number,
    amount: number,
    currency: string,
    type: TransactionType,
    description: string,
    transactionDate: Date,
    category: string,
    categoryId: number,
    account: string,
    accountId: number,
    bank: string,
    bankId: number,
    createdAt: Date,
  ) {
    this.id = id;
    this.amount = amount;
    this.currency = currency;
    this.type = type;
    this.description = description;
    this.transactionDate = transactionDate;
    this.category = category;
    this.account = account;
    this.bank = bank;
    this.createdAt = createdAt;
  }
}
