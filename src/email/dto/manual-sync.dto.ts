import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ManualSyncDto {
  @ApiProperty({ description: 'The name of the label to sync' })
  @IsNotEmpty({ message: 'Label name is required' })
  @IsString({ message: 'Label name must be a string' })
  labelName: string;
}
