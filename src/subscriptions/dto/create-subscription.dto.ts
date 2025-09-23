import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { BillingCycle, SubscriptionStatus } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Service name of the service', example: 'Netflix' })
  @IsNotEmpty({ message: 'Service name is required' })
  @IsString({ message: 'Service name must be a string' })
  serviceName: string;

  @ApiProperty({
    description: 'Status of the subscription',
    enum: Object.values(SubscriptionStatus),
    example: 'active',
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsString({ message: 'Status must be a string' })
  @IsEnum(SubscriptionStatus, {
    message: 'Status must be one of the following: active, paused, cancelled, free_trial',
  })
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Billing cycle of the subscription',
    enum: Object.values(BillingCycle),
    example: 'monthly',
  })
  @IsNotEmpty({ message: 'Billing cycle is required' })
  @IsString({ message: 'Billing cycle must be a string' })
  @IsEnum(BillingCycle, {
    message: 'Billing cycle must be one of the following: weekly, monthly, yearly',
  })
  billingCycle: BillingCycle;

  @ApiProperty({ description: 'Amount of the subscription', example: 15.99 })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  amount: number;

  @ApiProperty({ description: 'Currency of the subscription', example: 'USD' })
  @IsNotEmpty({ message: 'Currency is required' })
  @IsString({ message: 'Currency must be a string' })
  currency: string;

  @ApiProperty({
    description: 'Next payment date of the subscription',
    example: '2025-10-01T00:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  @IsNotEmpty({ message: 'Next payment date is required' })
  @IsString({ message: 'Next payment date must be a string' })
  nextPaymentDate: Date;

  @ApiProperty({
    description: 'Trail end date of the subscription',
    example: '2025-10-15',
    type: String,
    format: 'date',
  })
  @IsNotEmpty({ message: 'Trail end date is required' })
  @IsString({ message: 'Trail end date must be a string' })
  trailEndDate: Date;
}
