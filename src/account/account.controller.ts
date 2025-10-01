import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { AccountDto } from './dto/account.dto';

@ApiTags('Account Management')
@Controller('account')
@ApiBearerAuth()
@UseGuards(JwtGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all accounts',
    description: 'Returns a list of all accounts for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of accounts',
    type: AccountDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Error fetching accounts: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findAll(@CurrentUser() user: Partial<User>) {
    return await this.accountService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an account by ID',
    description: 'Fetch a single account by its ID.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Account ID', example: 123 })
  @ApiResponse({
    status: 200,
    description: 'Returns the account details',
    type: AccountDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Account or User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Account with ID 123 not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Error fetching account with ID: 123: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return await this.accountService.findOne(+id, user);
  }
}
