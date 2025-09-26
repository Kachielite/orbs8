import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/jwt.guard';
import { CurrentUser } from './decorators/current-user.decorator';

import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VerifyPasswordTokenDto } from './dto/verify-password-token.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account with the provided name, email, and password.',
  })
  @ApiBody({
    description: 'User registration payload',
    type: RegisterDto,
    examples: {
      example: {
        summary: 'Example',
        value: {
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          password: 'StrongPassw0rd!',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful, please login',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'Name must be at least 3 characters long',
            'Email must be a valid email address',
            'Password must be at least 8 characters long',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: { type: 'string', example: 'User with email example@email.com already exists' },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred during registration' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @Post('register')
  @HttpCode(201)
  async register(@Body() request: RegisterDto): Promise<GeneralResponseDto> {
    return await this.authService.register(request);
  }

  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticates a user with email and password and returns access and refresh tokens.',
  })
  @ApiBody({
    description: 'User login payload',
    type: LoginDto,
    examples: {
      example: {
        summary: 'Example',
        value: {
          email: 'jane.doe@example.com',
          password: 'StrongPassw0rd!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'Email must be a valid email address',
            'Password must be at least 8 characters long',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User with email example@email.com not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred during login' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @Post('login')
  async login(@Body() request: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(request);
  }

  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generates new access and refresh tokens using a valid refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refresh successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid refresh token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid refresh token' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred during token refresh' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @Post('refresh-token')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'The refresh token to be used for generating new tokens',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
      required: ['refreshToken'],
    },
    examples: {
      example: {
        summary: 'Example',
        value: { refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
  })
  async refreshToken(@Body('refreshToken') refreshToken: string): Promise<AuthResponseDto> {
    return await this.authService.refreshToken(refreshToken);
  }

  @ApiOperation({
    summary: 'Get current user information',
    description: 'Returns details of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiBearerAuth()
  @Get('me')
  @UseGuards(JwtGuard)
  getCurrentUser(@CurrentUser() user: UserResponseDto): UserResponseDto {
    return new UserResponseDto(user.id, user.email, user.name, user.emailLinked);
  }

  @ApiOperation({
    summary: 'Login with Google',
    description: 'Accepts a Google ID token and returns access and refresh tokens',
  })
  @ApiBody({
    description: 'Google login payload',
    type: GoogleLoginDto,
    examples: {
      example: {
        summary: 'Example',
        value: {
          idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijc4OTY5...',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid Google token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid Google token' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred during Google login' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @Post('google')
  async googleLogin(@Body() request: GoogleLoginDto): Promise<AuthResponseDto> {
    return this.authService.loginWithGoogle(request);
  }

  @ApiOperation({
    summary: 'Request password reset',
    description: "Initiates a password reset process by sending a reset link to the user's email.",
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully',
    type: GeneralResponseDto,
    schema: {
      example: {
        message: 'Password reset request sent successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User with email example@email.com not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred during password reset' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @ApiQuery({
    name: 'email',
    required: true,
    type: String,
    description: 'Email address of the user requesting password reset',
    example: 'user@example.com',
  })
  @Get('request-reset-password')
  async requestResetPassword(@Query('email') email: string): Promise<GeneralResponseDto> {
    return this.authService.requestPasswordReset(email);
  }

  @ApiOperation({
    summary: 'Reset user password',
    description: 'Resets the user password using a valid reset token and new password.',
  })
  @ApiBody({
    description: 'Reset password payload',
    type: ResetPasswordDto,
    examples: {
      example: {
        summary: 'Example',
        value: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          newPassword: 'NewStrongPassw0rd!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    type: GeneralResponseDto,
    schema: {
      example: {
        message: 'Password reset successful',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'Token must be a valid string',
            'New password must be at least 8 characters long',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Invalid or expired token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Reset token is invalid or expired' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred during password reset' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @Post('reset-password')
  async resetPassword(@Body() request: ResetPasswordDto): Promise<GeneralResponseDto> {
    return this.authService.resetPassword(request);
  }

  @ApiOperation({
    summary: 'Verify password reset token',
    description:
      'Validates a password reset token and associated email before allowing password reset.',
  })
  @ApiBody({
    description: 'Token verification payload',
    type: VerifyPasswordTokenDto,
    examples: {
      example: {
        summary: 'Example',
        value: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token verification successful',
    type: GeneralResponseDto,
    schema: {
      example: {
        message: 'Password reset token is valid',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Invalid or expired token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Invalid reset token' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['Token is required', 'Email must be a string'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred during password reset' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @Post('/verify-token')
  async verifyToken(@Body() request: VerifyPasswordTokenDto) {
    return this.authService.verifyPasswordResetToken(request);
  }
}
