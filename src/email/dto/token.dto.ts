import { ApiProperty } from '@nestjs/swagger';

export class TokenDto {
  @ApiProperty({ description: 'JWT access token' })
  public accessToken: string;
  @ApiProperty({ description: 'JWT refresh token' })
  public refreshToken: string;
  @ApiProperty({ description: 'JWT expires at' })
  public expiresAt: Date;

  constructor(accessToken: string, refreshToken: string, expiresAt: Date) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
  }
}
