import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BankService } from './bank.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { BankDto } from './dto/bank.dto';

@ApiTags('Bank Management')
@Controller('bank')
@ApiBearerAuth()
@UseGuards(JwtGuard)
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all banks',
    description: "Returns a list of banks associated with the authenticated user's accounts.",
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of banks',
    type: [BankDto],
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
        message: { type: 'string', example: 'Error fetching banks for user: 1: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findAll(@CurrentUser() user: Partial<User>) {
    return await this.bankService.getAllBanks(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a bank by ID',
    description: 'Fetch a single bank by its ID for the authenticated user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Bank ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Returns the bank details',
    type: BankDto,
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
    description: 'Not Found - Bank not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Bank with ID 1 not found for user 1' },
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
        message: { type: 'string', example: 'Error fetching bank with ID: 1: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return await this.bankService.getBankById(+id, user);
  }
}
