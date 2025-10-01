import { ApiProperty } from '@nestjs/swagger';

export class CurrencyDto {
  @ApiProperty({ description: 'The id of the currency' })
  id: number;
  @ApiProperty({ description: 'The name of the currency' })
  name: string;
  @ApiProperty({ description: 'The symbol of the currency' })
  symbol: string;
  @ApiProperty({ description: 'The code of the currency' })
  code: string;

  constructor(id: number, name: string, symbol: string, code: string) {
    this.id = id;
    this.name = name;
    this.symbol = symbol;
    this.code = code;
  }
}
