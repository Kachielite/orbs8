import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiProperty({ description: 'The ID of the transaction to update' })
  @IsNotEmpty({ message: 'Transaction ID is required' })
  @IsNumber({}, { message: 'Transaction ID must be a number' })
  transactionId: number;

  @ApiProperty({ description: 'The ID of the category to update' })
  @IsNotEmpty({ message: 'Category ID is required' })
  @IsNumber({}, { message: 'Category ID must be a number' })
  categoryId: number;

  @ApiProperty({ description: 'The name to identify similar categories in the future' })
  @IsString({ message: 'Common name must be a string' })
  @IsOptional()
  commonName: string;

  @ApiProperty({ description: 'Whether to apply the category to all transactions' })
  @IsOptional()
  applyToAll: boolean;
}
