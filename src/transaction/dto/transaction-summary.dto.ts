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
    description: 'The top 6 income categories',
    example: [
      { name: 'Salary', amount: 1000, percentage: 80.0 },
      { name: 'Freelance', amount: 200, percentage: 16.0 },
    ],
  })
  public topIncomeByCategory: TopTransactionDto[];
  @ApiProperty({
    description: 'The top 6 credit',
    example: [
      { name: 'Salary', amount: 1000, percentage: 80.0 },
      { name: 'Interest', amount: 50, percentage: 4.0 },
    ],
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
  @ApiProperty({
    description: 'Current month spend',
    example: 1500,
  })
  public currentMonthSpend: number;
  @ApiProperty({
    description: 'Current month income',
    example: 3000,
  })
  public currentMonthIncome: number;
  @ApiProperty({
    description: 'Last month spend',
    example: 1400,
  })
  public lastMonthSpend: number;
  @ApiProperty({
    description: 'Last month income',
    example: 2800,
  })
  public lastMonthIncome: number;
  @ApiProperty({
    description: 'Account-level summaries',
    example: [
      { accountName: 'Checking', totalSpend: 500, totalIncome: 2000, currentBalance: 1500 },
    ],
  })
  public accountSummaries: AccountSummaryDto[];
  @ApiProperty({
    description: 'Top merchants by spend',
    example: [
      { name: 'Amazon', amount: 200, percentage: 20.0 },
      { name: 'Starbucks', amount: 100, percentage: 10.0 },
    ],
  })
  public topMerchants: TopTransactionDto[];
}

export class TopTransactionDto {
  @ApiProperty({ description: 'The name of the category' })
  public name: string;
  @ApiProperty({ description: 'The amount spent in the category' })
  public amount: number;
  @ApiProperty({ description: 'The percentage of total spend/income that this amount represents' })
  public percentage: number;
  @ApiProperty({ description: 'Trend indicator compared to previous period', example: '↑' })
  public trend: string;

  constructor(name: string, amount: number, percentage?: number, trend?: string) {
    this.name = name;
    this.amount = amount;
    this.percentage = percentage ?? 0;
    this.trend = trend ?? '=';
  }
}

export class AccountSummaryDto {
  @ApiProperty({ description: 'The name of the account' })
  public accountName: string;
  @ApiProperty({ description: 'The total amount spent from this account' })
  public totalSpend: number;
  @ApiProperty({ description: 'The total amount earned in this account' })
  public totalIncome: number;
  @ApiProperty({ description: 'The current balance of the account' })
  public currentBalance: number;
}
