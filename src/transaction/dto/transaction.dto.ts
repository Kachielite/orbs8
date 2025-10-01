import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../entities/transaction.entity';

export class TransactionDto {
  @ApiProperty({ description: 'The id of the transaction' })
  id: number;

  @ApiProperty({ description: 'The amount of the transaction' })
  amount: number;

  @ApiProperty({ description: 'The date of the transaction' })
  currency: string;

  @ApiProperty({ description: 'The type of the transaction' })
  type: TransactionType;

  @ApiProperty({ description: 'The description of the transaction' })
  description: string;

  @ApiProperty({ description: 'The date of the transaction' })
  transactionDate: Date;

  @ApiProperty({ description: 'The category of the transaction' })
  category: string;

  @ApiProperty({ description: 'The account of the transaction' })
  account: string;

  @ApiProperty({ description: 'The bank of the transaction' })
  bank: string;

  @ApiProperty({ description: 'The date of the transaction' })
  createdAt: Date;

  constructor(
    id: number,
    amount: number,
    currency: string,
    type: TransactionType,
    description: string,
    transactionDate: Date,
    category: string,
    account: string,
    bank: string,
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
