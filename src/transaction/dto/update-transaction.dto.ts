import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateTransactionDto {
  @ApiProperty({ description: 'The ID of the category to associate with the transaction' })
  @IsNotEmpty({ message: 'Category ID is required' })
  @IsNumber({}, { message: 'Category ID must be a number' })
  categoryId: number;
}
