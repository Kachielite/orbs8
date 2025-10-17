import { ApiProperty } from '@nestjs/swagger';

export class TransactionSummaryDto {
  @ApiProperty({
    description: 'The top 4 spend categories',
    example: [
      { name: 'Food', amount: 100 },
      { name: 'Transportation', amount: 50 },
    ],
  })
  public topSpendByCategory: TopTransactionDto[];
  @ApiProperty({
    description: 'The top 4 credit',
    example: [
      { name: 'Salary', amount: 100 },
      { name: 'Interest', amount: 50 },
    ],
  })
  public topSpendByCreditType: TopTransactionDto[];
  @ApiProperty({
    description: 'The top 4 debit',
    example: [
      { name: 'Rent', amount: 100 },
      { name: 'Utilities', amount: 50 },
    ],
  })
  public topSpendByDebitType: TopTransactionDto[];
  @ApiProperty({
    description: 'The total spend and income',
    example: 10000,
  })
  public totalSpend: number;
  @ApiProperty({
    description: 'The total income',
    example: 5000,
  })
  public totalIncome: number;
  @ApiProperty({
    description: 'The total transactions',
    example: 10,
  })
  public totalTransactions: number;
}

export class TopTransactionDto {
  @ApiProperty({ description: 'The name of the category' })
  public name: string;
  @ApiProperty({ description: 'The amount spent in the category' })
  public amount: number;

  constructor(name: string, amount: number) {
    this.name = name;
    this.amount = amount;
  }
}
