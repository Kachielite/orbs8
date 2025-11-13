import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { CurrencyDto } from './dto/currency.dto';

@ApiTags('Currency Management')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all currencies',
    description: 'Returns a list of all available currencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of currencies',
    type: [CurrencyDto],
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
        message: { type: 'string', example: 'Error fetching currencies: <details>' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getAllCurrencies() {
    return this.currencyService.getAllCurrencies();
  }
}
