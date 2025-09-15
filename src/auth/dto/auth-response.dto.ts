export class AuthResponseDto {
  constructor(
    public accessToken: string,
    public refreshToken: string,
  ) {}
}
