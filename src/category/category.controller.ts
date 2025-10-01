import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CategoryService } from './category.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CategoryDto } from './dto/category.dto';

@ApiTags('Category Management')
@Controller('category')
@ApiBearerAuth()
@UseGuards(JwtGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Returns a list of all categories.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Optional search query to filter categories',
    example: 'food',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
    type: CategoryDto,
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
  async findAll(@Query() query?: string) {
    return await this.categoryService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a category by ID',
    description: 'Returns a specific category by its ID.',
  })
  @ApiParam({ name: 'id', description: 'ID of the category to retrieve', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Category details',
    type: CategoryDto,
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
    description: 'Category not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Category with ID 1 not found' },
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
        message: { type: 'string', example: 'Error fetching subscriptions: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async findOne(@Param('id') id: string) {
    return await this.categoryService.findOne(+id);
  }
}
