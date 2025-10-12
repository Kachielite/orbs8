import { ApiProperty } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto';

export class NotificationsResponseDto {
  @ApiProperty({
    description: 'Array of notifications',
    type: [NotificationDto],
    example: [
      {
        id: 1,
        title: 'Email sync started',
        description: 'Your email synchronization has begun',
        type: 'SYNC_STARTED',
        isRead: false,
        date: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        title: 'Email sync completed',
        description: 'Your email synchronization has finished successfully',
        type: 'SYNC_COMPLETED',
        isRead: true,
        date: '2024-01-01T00:30:00Z',
      },
    ],
  })
  public data: NotificationDto[];

  @ApiProperty({
    description: 'Total number of notifications',
    example: 2,
  })
  public total: number;

  constructor(data: NotificationDto[], total: number) {
    this.data = data;
    this.total = total;
  }
}
