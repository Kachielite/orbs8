import { Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { NotificationDto } from './dto/notification.dto';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { type NotificationQuery } from './notification.interface';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@ApiTags('Notification Management')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all notifications',
    description: 'Returns a list of all notifications for the authenticated user.',
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
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter notifications by read status',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of notifications',
    type: PaginatedResponseDto,
    example: {
      data: [
        {
          id: 1,
          userId: 1,
          title: 'New Transaction',
          message: 'You have received a new transaction',
          type: 'SYNC_STARTED',
          isRead: false,
          date: '2023-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      hasNext: false,
      hasPrev: false,
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
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Error fetching notifications: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findAll(@Query() query: NotificationQuery, @CurrentUser() user: Partial<User>) {
    return await this.notificationService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a notification by ID',
    description: 'Fetch a single notification by its ID.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Notification ID', example: 123 })
  @ApiResponse({
    status: 200,
    description: 'Returns the notification details',
    type: NotificationDto,
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
    description: 'Not Found - Notification not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Notification with ID 123 not found for user 1' },
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
        message: {
          type: 'string',
          example: 'Error fetching notification with ID: 123 for user: 1: <details>',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return await this.notificationService.findOne(+id, user);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Mark a notification as read',
    description: 'Mark a specific notification as read for the authenticated user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Notification ID', example: 123 })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
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
    status: 404,
    description: 'Not Found - Notification not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Notification with ID 123 not found for user 1' },
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
        message: {
          type: 'string',
          example: 'Error marking notification with ID: 123 as read for user: 1: <details>',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return await this.notificationService.markAsRead(+id, user);
  }

  @Post('/mark-all-as-read')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all notifications as read for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'All Notifications marked as read successfully',
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
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Error marking notifications as read for user: 1: <details>',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async markAllAsRead(@CurrentUser() user: Partial<User>) {
    return await this.notificationService.markAllAsRead(user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a notification',
    description: 'Delete a specific notification for the authenticated user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Notification ID', example: 123 })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
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
    status: 404,
    description: 'Not Found - Notification not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Notification with ID 123 not found for user 1' },
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
        message: {
          type: 'string',
          example: 'Error deleting notification with ID: 123 for user: 1: <details>',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async delete(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return await this.notificationService.delete(+id, user);
  }

  @Delete('/all')
  @ApiOperation({
    summary: 'Delete all notifications',
    description: 'Delete all notifications for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications deleted successfully',
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
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Error deleting all notifications for user: 1: <details>',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async deleteAll(@CurrentUser() user: Partial<User>) {
    return await this.notificationService.deleteAll(user);
  }
}
