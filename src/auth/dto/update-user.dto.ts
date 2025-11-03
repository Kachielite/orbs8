import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ description: 'Name of the user', example: 'Jane Doe' })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  name: string;

  @ApiProperty({ description: 'Preferred currency of the user', example: 'USD' })
  @IsString({ message: 'Currency code must be a string' })
  @IsOptional()
  preferredCurrency: string;

  // Both newPassword and oldPassword are optional overall, but if one is provided, both must be provided
  @ApiProperty({
    description: 'New password of the user',
    example: 'newPassword123',
    required: false,
  })
  @ValidateIf((o) => o.oldPassword !== undefined || o.newPassword !== undefined)
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'New password must not be empty when changing password' })
  newPassword: string;

  @ApiProperty({
    description: 'Old password of the user',
    example: 'oldPassword123',
    required: false,
  })
  @ValidateIf((o) => o.oldPassword !== undefined || o.newPassword !== undefined)
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Old password must not be empty when changing password' })
  oldPassword: string;
}
