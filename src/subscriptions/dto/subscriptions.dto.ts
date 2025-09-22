import { BillingCycle, SubscriptionStatus } from '../entities/subscription.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

export class SubscriptionDto {
  public id: number;
  public userId: number;
  public serviceName: string;
  public status: SubscriptionStatus;
  public billingCycle: BillingCycle;
  public amount: number;
  public currency: string;
  public nextPaymentDate: Date;
  public createdAt: Date;
  public updatedAt: Date;
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
  constructor(
    public data: SubscriptionDto[],
    public total: number,
    public page: number,
    public limit: number,
    public hasNext: boolean,
    public hasPrev: boolean,
  ) {
    super(data, total, page, limit, hasNext, hasPrev);
  }
}
