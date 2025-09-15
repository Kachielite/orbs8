import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtGuard } from './guards/jwt.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() request: RegisterDto): Promise<GeneralResponseDto> {
    return await this.authService.register(request);
  }

  @Post('login')
  async login(@Body() request: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(request);
  }

  @Post('refresh-token')
  async refreshToken(@Body('refreshToken') refreshToken: string): Promise<AuthResponseDto> {
    return await this.authService.refreshToken(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  getCurrentUser(@CurrentUser() user: UserResponseDto): UserResponseDto {
    return new UserResponseDto(user.id, user.email, user.name);
  }
}
