import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum EmailProvider {
  GMAIL = 'gmail',
  OUTLOOK = 'outlook',
}

export enum EmailSyncStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity()
export class Email {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'enum',
    enum: EmailProvider,
    default: EmailProvider.GMAIL,
  })
  provider: EmailProvider;

  @Column()
  accessToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  lastSyncAt: Date;

  @Column({ default: 0 })
  emailsReceived: number;

  @Column({
    type: 'enum',
    enum: EmailSyncStatus,
    default: EmailSyncStatus.IDLE,
  })
  syncStatus: EmailSyncStatus;

  @Column({ type: 'text', nullable: true })
  failedReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
