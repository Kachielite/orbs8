import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google ID token obtained from Google Identity Services on the client',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijc4OTY5...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
