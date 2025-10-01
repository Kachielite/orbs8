import { ApiProperty } from '@nestjs/swagger';

export class GeneralResponseDto {
  @ApiProperty({ description: 'The message of the response', example: 'Operation successful' })
  public message: string;

  constructor(message: string) {
    this.message = message;
  }
}
