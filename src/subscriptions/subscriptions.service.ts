import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException, } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { User } from '../auth/entities/user.entity';
import logger from '../common/utils/logger/logger';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { GetSubscriptionQuery } from './interface/get-subscription-query';
import { SubscriptionDto, SubscriptionsResponseDto } from './dto/subscriptions.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async create(
    createSubscriptionDto: CreateSubscriptionDto,
    user: Partial<User>,
  ): Promise<GeneralResponseDto> {
    logger.info(`Creating subscription for user: ${user.id}`);
    try {
      const fullUserDetails = await this.userRepository.findOneBy({
        id: user.id,
      });

      if (!fullUserDetails) {
        throw new NotFoundException(`User with ID ${user.id} not found`);
      }

      const newSubscription = this.subscriptionRepository.create({
        ...createSubscriptionDto,
        user: fullUserDetails,
      });

      await this.subscriptionRepository.save(newSubscription);
      logger.info(`Subscription created for user: ${user.id}`);
      return new GeneralResponseDto('Subscription created successfully');
    } catch (error) {
      logger.error(`Error creating subscription for user: ${user.id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Error creating subscription for user: ${user.id}: ${error.message}`,
      );
    }
  }

  async findAll(query: GetSubscriptionQuery): Promise<SubscriptionsResponseDto> {
    const { page, limit, search } = query;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

    // Validate and normalize sort/order
    const allowedSortFields: Array<keyof Subscription> = [
      'serviceName',
      'status',
      'billingCycle',
      'amount',
      'currency',
      'nextPaymentDate',
      'createdAt',
      'trailEndDate',
    ];
    const sortRaw = (query.sort as keyof Subscription) || 'createdAt';
    const sortField = allowedSortFields.includes(sortRaw) ? sortRaw : 'createdAt';
    const orderRaw = (query.order || 'DESC').toString().toUpperCase();
    const orderDir: 'ASC' | 'DESC' = orderRaw === 'ASC' ? 'ASC' : 'DESC';
    const orderParam = { [sortField]: orderDir } as Record<string, 'ASC' | 'DESC'>;

    logger.info(`Fetching subscriptions with query: ${JSON.stringify(query)}`);
    try {
      const [subscriptions, total] = await this.subscriptionRepository.findAndCount({
        where: search ? { serviceName: ILike(`%${search}%`) } : {},
        relations: ['user'],
        skip,
        take,
        order: orderParam,
      });

      const hasNext = skip + take < total;
      const hasPrevious = skip > 0;
      const subscriptionsDto = subscriptions.map((subscription) =>
        this.convertSubscriptionToDto(subscription, subscription.user.id),
      );

      return new SubscriptionsResponseDto(
        subscriptionsDto,
        total,
        safePage,
        safeLimit,
        hasNext,
        hasPrevious,
      );
    } catch (error) {
      logger.error(`Error fetching subscriptions: ${error.message}`);
      throw new InternalServerErrorException(`Error fetching subscriptions: ${error.message}`);
    }
  }

  async findOne(id: number, user: Partial<User>): Promise<SubscriptionDto> {
    logger.info(`Fetching subscription with ID: ${id}`);
    try {
      const fullUserDetails = await this.userRepository.findOneBy({
        id: user.id,
      });
      if (!fullUserDetails) {
        throw new NotFoundException(`User with ID ${user.id} not found`);
      }
      const subscription = await this.subscriptionRepository.findOne({
        where: {
          id,
        },
        relations: ['user'],
      });

      if (!subscription) {
        throw new NotFoundException(`Subscription with ID ${id} not found`);
      }

      return this.convertSubscriptionToDto(subscription, fullUserDetails.id);
    } catch (error) {
      logger.error(`Error fetching subscription with ID: ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error fetching subscription with ID: ${id}: ${error.message}`,
      );
    }
  }

  async update(
    id: number,
    updateSubscriptionDto: UpdateSubscriptionDto,
    user: Partial<User>,
  ): Promise<GeneralResponseDto> {
    logger.info(`Update request received for subscription with ID: ${id}`);
    try {
      const fullUserDetails = await this.userRepository.findOneBy({
        id: user.id,
      });

      if (!fullUserDetails) {
        throw new NotFoundException(`User with ID ${user.id} not found`);
      }

      const subscription = await this.subscriptionRepository.findOne({
        where: {
          id,
          user: fullUserDetails,
        },
      });

      if (!subscription) {
        throw new NotFoundException(`Subscription with ID ${id} not found`);
      }

      if (subscription.user.id !== fullUserDetails.id) {
        throw new UnauthorizedException('Only the owner of the subscription can update it.');
      }

      const updatedSubscription = this.subscriptionRepository.merge(
        subscription,
        updateSubscriptionDto,
      );
      await this.subscriptionRepository.save(updatedSubscription);
      logger.info(`Subscription with ID: ${id} updated successfully`);
      return new GeneralResponseDto('Subscription updated successfully');
    } catch (error) {
      logger.error(`Error updating subscription with ID: ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error updating subscription with ID: ${id}: ${error.message}`,
      );
    }
  }

  async remove(id: number, user: Partial<User>): Promise<GeneralResponseDto> {
    logger.info(`Delete request received for subscription with ID: ${id}`);
    try {
      const fullUserDetails = await this.userRepository.findOneBy({
        id: user.id,
      });

      if (!fullUserDetails) {
        throw new NotFoundException(`User with ID ${user.id} not found`);
      }

      const subscription = await this.subscriptionRepository.findOne({
        where: {
          id,
          user: fullUserDetails,
        },
      });

      if (!subscription) {
        throw new NotFoundException(`Subscription with ID ${id} not found`);
      }

      if (subscription.user.id !== fullUserDetails.id) {
        throw new UnauthorizedException('Only the owner of the subscription can delete it.');
      }

      await this.subscriptionRepository.remove(subscription);
      logger.info(`Subscription with ID: ${id} deleted successfully`);
      return new GeneralResponseDto('Subscription deleted successfully');
    } catch (error) {
      logger.error(`Error deleting subscription with ID: ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error deleting subscription with ID: ${id}: ${error.message}`,
      );
    }
  }

  private convertSubscriptionToDto(subscription: Subscription, userId: number): SubscriptionDto {
    return new SubscriptionDto(
      subscription.id,
      userId,
      subscription.serviceName,
      subscription.status,
      subscription.billingCycle,
      subscription.amount,
      subscription.currency,
      subscription.nextPaymentDate,
      subscription.createdAt,
      subscription.updatedAt,
      subscription.trailEndDate,
    );
  }
}
