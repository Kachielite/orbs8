import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'The ID of the user' })
  public id: number;
  @ApiProperty({ description: 'The email of the user' })
  public email: string;
  @ApiProperty({ description: 'The name of the user' })
  public name: string;

  constructor(id: number, email: string, name: string) {
    this.id = id;
    this.email = email;
    this.name = name;
  }
}
