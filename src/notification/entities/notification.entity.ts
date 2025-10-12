import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationType {
  SYNC_STARTED = 'sync_started',
  SYNC_PROGRESS = 'sync_progress',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
}

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYNC_STARTED,
  })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
