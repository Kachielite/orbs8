import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { type GetSubscriptionQuery } from './interface/get-subscription-query';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { SubscriptionDto, SubscriptionsResponseDto } from './dto/subscriptions.dto';

@ApiTags('Subscriptions Management')
@Controller('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  create(@Body() createSubscriptionDto: CreateSubscriptionDto, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.create(createSubscriptionDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Returns a paginated list of subscriptions',
    type: SubscriptionsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  findAll(@Query() query: GetSubscriptionQuery, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the subscription details',
    type: SubscriptionDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Subscription or User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.findOne(+id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this subscription',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Subscription or User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @CurrentUser() user: Partial<User>,
  ) {
    return this.subscriptionsService.update(+id, updateSubscriptionDto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription deleted successfully',
    type: GeneralResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token is missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this subscription',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Subscription or User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  remove(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return this.subscriptionsService.remove(+id, user);
  }
}
