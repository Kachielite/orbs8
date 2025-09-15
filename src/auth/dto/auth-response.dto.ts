import { GeneralResponseDto } from '../../common/dto/general-response.dto';

export class AuthResponseDto extends GeneralResponseDto {
  constructor(
    message: string,
    public accessToken: string,
    public refreshToken: string,
  ) {
    super(message);
  }
}
