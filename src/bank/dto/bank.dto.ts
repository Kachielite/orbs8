import { ApiProperty } from '@nestjs/swagger';

export class BankDto {
  @ApiProperty({ description: 'The ID of the bank', example: 1 })
  public id: number;
  @ApiProperty({ description: 'The name of the bank', example: 'Bank of America' })
  public name: string;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}