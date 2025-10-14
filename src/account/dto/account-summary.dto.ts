import { ApiProperty } from '@nestjs/swagger';

export class AccountSummaryDto {
  @ApiProperty({ description: 'The total balance of the user accounts', example: '10000.00' })
  public totalBalance: number;
  @ApiProperty({ description: 'The change in spend amount', example: '2.5' })
  public spendChange: number;
  @ApiProperty({ description: 'The number of user accounts', example: '5' })
  public numberOfAccounts: number;

  constructor(totalBalance: number, spendChange: number, numberOfAccounts: number) {
    this.totalBalance = totalBalance;
    this.spendChange = spendChange;
    this.numberOfAccounts = numberOfAccounts;
  }
}
