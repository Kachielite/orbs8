import { ApiProperty } from '@nestjs/swagger';

export class ClassifyTransactionDto {
  @ApiProperty({
    description: 'The description of the transaction',
    example: 'PWL*GLOVO (SEP28)(29/09/2025)',
  })
  public description: string;

  constructor(description: string) {
    this.description = description;
  }
}
