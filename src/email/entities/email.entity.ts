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

  @Column({ nullable: true })
  refreshToken: string | null;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  lastSyncAt: Date;

  @Column({ default: 0 })
  emailsReceived: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
