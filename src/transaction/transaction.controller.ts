import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { type GetTransactionQuery } from './interface/transaction-query.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { TransactionDto } from './dto/transaction.dto';
import { GeneralResponseDto } from '../common/dto/general-response.dto';

@ApiTags('Transaction Management')
@Controller('transaction')
@ApiBearerAuth()
@UseGuards(JwtGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all transactions',
    description: "Returns a paginated list of the authenticated user's transactions.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (min 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (1-100)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Filter by description or merchant (case-insensitive partial match)',
    example: 'coffee',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort field. Example: amount, date, createdAt',
    example: 'date',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['ASC', 'DESC', 'asc', 'desc'],
    example: 'DESC',
    description: 'Sort direction',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a paginated list of transactions',
    type: PaginatedResponseDto<TransactionDto>,
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
        message: { type: 'string', example: 'Error creating transaction for user: 1: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findAll(@Query() query: GetTransactionQuery, @CurrentUser() user: Partial<User>) {
    return await this.transactionService.findAll(user, query);
  }

  @Get('/account/:accountId')
  @ApiOperation({
    summary: 'Get transactions by account',
    description:
      'Returns a paginated list of transactions for the given account belonging to the authenticated user.',
  })
  @ApiParam({ name: 'accountId', type: Number, description: 'Account ID', example: 123 })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (min 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (1-100)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Filter by description or merchant (case-insensitive partial match)',
    example: 'coffee',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort field. Example: amount, date, createdAt',
    example: 'date',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['ASC', 'DESC', 'asc', 'desc'],
    example: 'DESC',
    description: 'Sort direction',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns transactions for the specified account',
    type: PaginatedResponseDto<TransactionDto>,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Error fetching transactions for user ID: 123: <details>',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findAllByAccount(
    @Query() query: GetTransactionQuery,
    @Param('accountId') accountId: string,
    @CurrentUser() user: Partial<User>,
  ) {
    return await this.transactionService.findAllByAccount(+accountId, query, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a transaction by ID',
    description: 'Fetch a single transaction by its ID for the authenticated user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Transaction ID', example: 456 })
  @ApiResponse({
    status: 200,
    description: 'Returns the transaction details',
    type: TransactionDto,
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
    description: 'Not Found - transactions or User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'transaction with ID 123 not found' },
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
        message: { type: 'string', example: 'Error fetching transaction with ID: 123: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return await this.transactionService.findOne(+id, user);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a transaction',
    description: 'Update fields of a transaction owned by the authenticated user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Transaction ID', example: 456 })
  @ApiBody({ description: 'Transaction details to update', type: UpdateTransactionDto })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid input' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
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
    description: 'Not Found - transactions or User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'transaction with ID 123 not found' },
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
        message: { type: 'string', example: 'Error fetching transaction with ID: 123: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: Partial<User>,
  ) {
    return await this.transactionService.update(+id, user, updateTransactionDto);
  }
}
