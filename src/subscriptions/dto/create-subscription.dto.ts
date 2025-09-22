import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { BillingCycle, SubscriptionStatus } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Service name of the service' })
  @IsNotEmpty({ message: 'Service name is required' })
  @IsString({ message: 'Service name must be a string' })
  serviceName: string;

  @ApiProperty({ description: 'Status of the subscription' })
  @IsNotEmpty({ message: 'Status is required' })
  @IsString({ message: 'Status must be a string' })
  @IsEnum(SubscriptionStatus, {
    message: 'Status must be one of the following: active, paused, cancelled, free_trial',
  })
  status: SubscriptionStatus;

  @ApiProperty({ description: 'Billing cycle of the subscription' })
  @IsNotEmpty({ message: 'Billing cycle is required' })
  @IsString({ message: 'Billing cycle must be a string' })
  @IsEnum(BillingCycle, {
    message: 'Billing cycle must be one of the following: weekly, monthly, yearly',
  })
  billingCycle: BillingCycle;

  @ApiProperty({ description: 'Amount of the subscription' })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  amount: number;

  @ApiProperty({ description: 'Currency of the subscription' })
  @IsNotEmpty({ message: 'Currency is required' })
  @IsString({ message: 'Currency must be a string' })
  currency: string;

  @ApiProperty({ description: 'Next payment date of the subscription' })
  @IsNotEmpty({ message: 'Next payment date is required' })
  @IsString({ message: 'Next payment date must be a string' })
  nextPaymentDate: Date;

  @ApiProperty({ description: 'Trail end date of the subscription' })
  @IsNotEmpty({ message: 'Trail end date is required' })
  @IsString({ message: 'Trail end date must be a string' })
  trailEndDate: Date;
}
