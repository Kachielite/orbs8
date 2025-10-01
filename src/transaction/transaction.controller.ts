import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { type GetTransactionQuery } from './interface/transaction-query.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  async findAll(@Query() query: GetTransactionQuery, @CurrentUser() user: Partial<User>) {
    return await this.transactionService.findAll(user, query);
  }

  @Get('/account/:accountId')
  async findAllByAccount(
    @Query() query: GetTransactionQuery,
    @Param() accountId: string,
    @CurrentUser() user: Partial<User>,
  ) {
    return await this.transactionService.findAllByAccount(+accountId, query, user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: Partial<User>) {
    return await this.transactionService.findOne(+id, user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: Partial<User>,
  ) {
    return await this.transactionService.update(+id, user, updateTransactionDto);
  }
}
