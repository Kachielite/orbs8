import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { type GetSubscriptionQuery } from './interface/get-subscription-query';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { SubscriptionDto, SubscriptionsResponseDto } from './dto/subscriptions.dto';

@ApiTags('Subscriptions Management')
@Controller('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new subscription',
    description: 'Creates a subscription for the authenticated user.',
  })
  @ApiBody({
    description: 'Subscription details',
    type: CreateSubscriptionDto,
    examples: {
      basic: {
        summary: 'Example',
        value: {
          serviceName: 'Netflix',
          status: 'active',
          billingCycle: 'monthly',
          amount: 15.99,
          currency: 'USD',
          nextPaymentDate: '2025-10-01T00:00:00.000Z',
          trailEndDate: '2025-10-15T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
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
            'Service name is required',
            'Status must be one of the following: active, paused, cancelled, free_trial',
            'Billing cycle must be one of the following: weekly, monthly, yearly',
          ],
        },
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
    description: 'Not Found - User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User with ID 1 not found' },
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
        message: { type: 'string', example: 'Error creating subscription for user: 1: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  create(@Body() createSubscriptionDto: CreateSubscriptionDto, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.create(createSubscriptionDto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all subscriptions',
    description: "Returns a paginated list of the current user's subscriptions.",
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
    description: 'Filter by service name (case-insensitive partial match)',
    example: 'net',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description:
      'Sort field. Allowed: serviceName, status, billingCycle, amount, currency, nextPaymentDate, createdAt, trailEndDate',
    example: 'createdAt',
    enum: [
      'serviceName',
      'status',
      'billingCycle',
      'amount',
      'currency',
      'nextPaymentDate',
      'createdAt',
      'trailEndDate',
    ],
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
    description: 'Returns a paginated list of subscriptions',
    type: SubscriptionsResponseDto,
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
        message: { type: 'string', example: 'Error fetching subscriptions: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  findAll(@Query() query: GetSubscriptionQuery, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a subscription by ID',
    description: 'Fetch a single subscription by its ID.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Subscription ID', example: 123 })
  @ApiResponse({
    status: 200,
    description: 'Returns the subscription details',
    type: SubscriptionDto,
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
    description: 'Not Found - Subscription or User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Subscription with ID 123 not found' },
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
        message: { type: 'string', example: 'Error fetching subscription with ID: 123: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  findOne(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.findOne(+id, user);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a subscription',
    description: 'Update fields of a subscription owned by the authenticated user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Subscription ID', example: 123 })
  @ApiBody({
    description: 'Fields to update (all optional)',
    type: UpdateSubscriptionDto,
    examples: {
      partial: {
        summary: 'Example',
        value: {
          status: 'paused',
          amount: 12.99,
          nextPaymentDate: '2025-11-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
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
            'Amount must be a number',
            'Status must be one of the following: active, paused, cancelled, free_trial',
          ],
        },
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
    status: 403,
    description: 'Forbidden - User does not own this subscription',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Only the owner of the subscription can update it.' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Subscription or User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Subscription with ID 123 not found' },
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
        message: { type: 'string', example: 'Error updating subscription with ID: 123: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @CurrentUser() user: Partial<User>,
  ) {
    return this.subscriptionsService.update(+id, updateSubscriptionDto, user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a subscription',
    description: 'Delete a subscription owned by the authenticated user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Subscription ID', example: 123 })
  @ApiResponse({
    status: 200,
    description: 'Subscription deleted successfully',
    type: GeneralResponseDto,
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
    status: 403,
    description: 'Forbidden - User does not own this subscription',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Only the owner of the subscription can delete it.' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Subscription or User not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Subscription with ID 123 not found' },
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
        message: { type: 'string', example: 'Error deleting subscription with ID: 123: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  remove(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.remove(+id, user);
  }
}
