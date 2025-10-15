import { Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class AccountDto {
  @ApiProperty({ description: 'The id of the account', example: 1 })
  id: number;

  @ApiProperty({ description: 'The name of the account', example: 'Savings Account' })
  accountName: string;

  @ApiProperty({ description: 'The account number of the account', example: '1234567890' })
  accountNumber: string;

  @ApiProperty({ description: 'The current balance of the account', example: 1000.0 })
  currentBalance: number;

  @ApiProperty({ description: 'The currency of the account', example: 'US Dollar' })
  currencyName: string;

  @ApiProperty({ description: 'The currency code of the account', example: 'USD' })
  currencyCode: string;

  @ApiProperty({ description: 'The bank id of the account', example: 1 })
  bankId: number;

  @ApiProperty({ description: 'The bank name of the account', example: 'Bank of America' })
  bankName: string;

  constructor(
    id: number,
    accountName: string,
    accountNumber: string,
    currentBalance: number,
    currencyName: string,
    currencyCode: string,
    bankId: number,
    bankName: string,
  ) {
    this.id = id;
    this.accountName = accountName;
    this.accountNumber = accountNumber;
    this.currentBalance = currentBalance;
    this.currencyName = currencyName;
    this.currencyCode = currencyCode;
    this.bankId = bankId;
    this.bankName = bankName;
  }
}
