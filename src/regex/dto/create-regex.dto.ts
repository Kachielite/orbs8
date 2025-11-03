import { IsNotEmpty, IsObject } from 'class-validator';

export class CreateRegexDto {
  @IsNotEmpty()
  bankId: number;

  @IsObject()
  @IsNotEmpty()
  pattern: Record<string, string>;
}
