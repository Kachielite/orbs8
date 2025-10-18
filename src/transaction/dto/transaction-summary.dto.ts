import { ApiProperty } from '@nestjs/swagger';

export class TransactionSummaryDto {
  @ApiProperty({
    description: 'The top 6 spend categories',
    example: [
      { name: 'Food', amount: 100, percentage: 25.0 },
      { name: 'Transportation', amount: 50, percentage: 12.5 },
    ],
  })
  public topSpendByCategory: TopTransactionDto[];
  @ApiProperty({
    description: 'The top 6 credit',
    example: [
      { name: 'Salary', amount: 1000, percentage: 80.0 },
      { name: 'Interest', amount: 50, percentage: 4.0 },
    ],
  })
  public topSpendByCreditType: TopTransactionDto[];
  @ApiProperty({
    description: 'The top 6 debit',
    example: [
      { name: 'Rent', amount: 500, percentage: 50.0 },
      { name: 'Utilities', amount: 50, percentage: 5.0 },
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
  @ApiProperty({ description: 'The percentage of total spend/income that this amount represents' })
  public percentage: number;

  constructor(name: string, amount: number, percentage?: number) {
    this.name = name;
    this.amount = amount;
    this.percentage = percentage ?? 0;
  }
}
