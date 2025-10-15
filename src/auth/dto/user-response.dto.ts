import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'The ID of the user' })
  public id: number;
  @ApiProperty({ description: 'The email of the user' })
  public email: string;
  @ApiProperty({ description: 'The name of the user' })
  public name: string;
  @ApiProperty({ description: 'Whether the app is linked to a Google account' })
  public emailLinked: boolean;
  @ApiProperty({ description: 'The preferred currency of the user' })
  preferredCurrency: string;

  constructor(
    id: number,
    email: string,
    name: string,
    emailLinked: boolean,
    preferredCurrency: string,
  ) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.emailLinked = emailLinked;
    this.preferredCurrency = preferredCurrency;
  }
}
