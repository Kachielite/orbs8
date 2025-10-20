import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../auth/entities/user.entity';
import logger from '../common/utils/logger/logger';
import { NotificationDto } from './dto/notification.dto';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { EmailGateway } from '../email/email.gateway';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { NotificationQuery } from './notification.interface';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @Inject(forwardRef(() => EmailGateway))
    private readonly emailGateway: EmailGateway,
  ) {}

  async createAndEmit(
    title: string,
    description: string,
    type: NotificationType,
    userId: number,
    emitOnly: boolean = false,
    progress?: number,
  ) {
    try {
      logger.info(`Creating and emitting notification for user: ${userId}`);
      const newNotification = this.notificationRepository.create({
        title,
        description,
        type,
        userId,
      });

      if (!emitOnly) {
        await this.notificationRepository.save(newNotification);
      }

      this.emailGateway.sendToUser(userId.toString(), type, {
        title,
        description,
        progress,
      });
    } catch (error) {
      logger.error(`Error creating and emitting notification: ${error.message}`);
      throw new InternalServerErrorException(
        `Error creating and emitting notification: ${error.message}`,
      );
    }
  }

  async findAll(
    user: Partial<User>,
    query: NotificationQuery,
  ): Promise<PaginatedResponseDto<NotificationDto>> {
    try {
      logger.info(`Fetching notifications for user: ${user.id}`);
      const { page, limit, isRead } = query;

      const [notifications, total] = await this.notificationRepository.findAndCount({
        where: { userId: user.id, ...(isRead !== undefined ? { isRead } : {}) },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      const hasNext = total > (page - 1) * limit + notifications.length;
      const hasPrevious = page > 1;

      const notificationDtos = notifications.map((notification: Notification) =>
        this.convertToDto(notification),
      );
      return new PaginatedResponseDto(notificationDtos, total, page, limit, hasNext, hasPrevious);
    } catch (error) {
      logger.error(`Error fetching notifications: ${error.message}`);
      throw new InternalServerErrorException(`Error fetching notifications: ${error.message}`);
    }
  }

  async findOne(id: number, user: Partial<User>): Promise<NotificationDto> {
    try {
      logger.info(`Fetching notification with ID: ${id} for user: ${user.id}`);
      const notification = await this.notificationRepository.findOne({
        where: { id, userId: user.id },
      });
      if (!notification) {
        throw new NotFoundException(`Notification with ID ${id} not found for user ${user.id}`);
      }
      return this.convertToDto(notification);
    } catch (error) {
      logger.error(
        `Error fetching notification with ID: ${id} for user: ${user.id}: ${error.message}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error fetching notification with ID: ${id} for user: ${user.id}: ${error.message}`,
      );
    }
  }

  async markAsRead(id: number, user: Partial<User>): Promise<GeneralResponseDto> {
    try {
      logger.info(
        `Received request to mark notification with ID: ${id} as read for user: ${user.id}`,
      );

      const notification = await this.notificationRepository.findOne({
        where: { id, userId: user.id },
      });
      if (!notification) {
        throw new NotFoundException(`Notification with ID ${id} not found for user ${user.id}`);
      }

      this.notificationRepository.merge(notification, { isRead: true });
      await this.notificationRepository.save(notification);

      return new GeneralResponseDto('Notification marked as read successfully');
    } catch (error) {
      logger.error(
        `Error marking notification with ID: ${id} as read for user: ${user.id}: ${error.message}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error marking notification with ID: ${id} as read for user: ${user.id}: ${error.message}`,
      );
    }
  }

  async markAllAsRead(user: Partial<User>): Promise<GeneralResponseDto> {
    try {
      console.log('user:', user);
      logger.info(`Received request to mark all notifications as read for user: ${user.id}`);

      // Use bulk update for better performance and reliability
      const result = await this.notificationRepository.update(
        { userId: user.id, isRead: false },
        { isRead: true },
      );

      logger.info(`Marked all ${result.affected} notifications as read for user: ${user.id}`);
      return new GeneralResponseDto('All notifications marked as read successfully');
    } catch (error) {
      logger.error(`Error marking all notifications as read for user: ${user.id}: ${error}`);
      throw new InternalServerErrorException(
        `Error marking all notifications as read for user: ${user.id}: ${error.message}`,
      );
    }
  }

  private convertToDto(notification: Notification): NotificationDto {
    return new NotificationDto(
      notification.id,
      notification.title,
      notification.description,
      notification.type,
      notification.isRead,
      notification.createdAt,
    );
  }
}
