import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../entities/notification.entity';

export class NotificationDto {
  @ApiProperty({ description: 'The ID of the notification', example: 1 })
  public id: number;

  @ApiProperty({ description: 'The title of the notification', example: 'New Notification' })
  title: string;

  @ApiProperty({
    description: 'The description of the notification',
    example: 'This is a new notification',
  })
  description: string;

  @ApiProperty({ description: 'The type of notification', example: 'SYNC_STARTED' })
  type: NotificationType;

  @ApiProperty({ description: 'Whether the notification is read', example: false })
  isRead: boolean;

  @ApiProperty({
    description: 'The date when the notification was created',
    example: '2024-01-01T00:00:00Z',
  })
  date: Date;

  constructor(
    id: number,
    title: string,
    description: string,
    type: NotificationType,
    isRead: boolean,
    date: Date,
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.type = type;
    this.isRead = isRead;
    this.date = date;
  }
}
