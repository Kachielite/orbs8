import { Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class AccountDto {
  @ApiProperty({ description: 'The id of the account' })
  id: number;

  @ApiProperty({ description: 'The name of the account' })
  accountName: string;

  @ApiProperty({ description: 'The account number of the account' })
  accountNumber: string;

  @ApiProperty({ description: 'The currency of the account' })
  currencyName: string;

  @ApiProperty({ description: 'The currency code of the account' })
  currencyCode: string;

  @ApiProperty({ description: 'The bank id of the account' })
  bankId: number;

  @ApiProperty({ description: 'The bank name of the account' })
  bankName: string;

  constructor(
    id: number,
    accountName: string,
    accountNumber: string,
    currencyName: string,
    currencyCode: string,
    bankId: number,
    bankName: string,
  ) {
    this.id = id;
    this.accountName = accountName;
    this.accountNumber = accountNumber;
    this.currencyName = currencyName;
    this.currencyCode = currencyCode;
    this.bankId = bankId;
    this.bankName = bankName;
  }
}
