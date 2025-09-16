import { ApiProperty } from '@nestjs/swagger';
import { GeneralResponseDto } from '../../common/dto/general-response.dto';

export class AuthResponseDto extends GeneralResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  constructor(message: string, accessToken: string, refreshToken: string) {
    super(message);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}
