import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTransactionDto {
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
