import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiResponse({
    status: 200,
    description: 'System is healthy',
    schema: {
      type: 'string',
      example: 'System is running and healthy',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'An error occurred checking system health' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @Get('health')
  getHello(): string {
    return 'System is running and healthy ';
  }
}
