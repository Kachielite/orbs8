export type SubscriptionSortField =
  | 'id'
  | 'serviceName'
  | 'status'
  | 'billingCycle'
  | 'amount'
  | 'currency'
  | 'nextPaymentDate'
  | 'createdAt'
  | 'updatedAt'
  | 'trailEndDate';

export type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

export interface GetSubscriptionQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: SubscriptionSortField;
  order?: OrderDirection;
}
