import { BillingCycle, SubscriptionStatus } from '../entities/subscription.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionDto {
  @ApiProperty({ description: 'Unique identifier of the subscription', example: 123 })
  public id: number;

  @ApiProperty({ description: 'Owner user ID', example: 42 })
  public userId: number;

  @ApiProperty({ description: 'Service name', example: 'Netflix' })
  public serviceName: string;

  @ApiProperty({
    description: 'Current status of the subscription',
    enum: Object.values(SubscriptionStatus),
    example: 'active',
  })
  public status: SubscriptionStatus;

  @ApiProperty({
    description: 'Billing cycle of the subscription',
    enum: Object.values(BillingCycle),
    example: 'monthly',
  })
  public billingCycle: BillingCycle;

  @ApiProperty({ description: 'Recurring charge amount', example: 15.99 })
  public amount: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'USD' })
  public currency: string;

  @ApiProperty({
    description: 'Next payment date',
    example: '2025-10-01T00:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  public nextPaymentDate: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-09-01T12:34:56.000Z',
    type: String,
    format: 'date-time',
  })
  public createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-09-15T08:20:00.000Z',
    type: String,
    format: 'date-time',
  })
  public updatedAt: Date;

  @ApiProperty({
    description: 'Trial end date (if applicable)',
    required: false,
    example: '2025-10-15',
    type: String,
    format: 'date',
  })
  public trailEndDate?: Date;

  constructor(
    id: number,
    userId: number,
    serviceName: string,
    status: SubscriptionStatus,
    billingCycle: BillingCycle,
    amount: number,
    currency: string,
    nextPaymentDate: Date,
    createdAt: Date,
    updatedAt: Date,
    trailEndDate?: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.serviceName = serviceName;
    this.status = status;
    this.billingCycle = billingCycle;
    this.amount = amount;
    this.currency = currency;
    this.nextPaymentDate = nextPaymentDate;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.trailEndDate = trailEndDate;
  }
}

export class SubscriptionsResponseDto extends PaginatedResponseDto<SubscriptionDto> {
  @ApiProperty({ description: 'Subscriptions on the current page', type: () => [SubscriptionDto] })
  declare public data: SubscriptionDto[];

  @ApiProperty({ description: 'Total number of records', example: 25 })
  declare public total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  declare public page: number;

  @ApiProperty({ description: 'Page size', example: 10 })
  declare public limit: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  declare public hasNext: boolean;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  declare public hasPrev: boolean;

  constructor(
    data: SubscriptionDto[],
    total: number,
    page: number,
    limit: number,
    hasNext: boolean,
    hasPrev: boolean,
  ) {
    super(data, total, page, limit, hasNext, hasPrev);
  }
}
