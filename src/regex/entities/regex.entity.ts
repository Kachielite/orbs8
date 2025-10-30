import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Bank } from '../../bank/entities/bank.entity';

export enum RegexCreatedBy {
  LLM = 'LLM',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MANUAL = 'MANUAL',
}

export enum RegexAuditStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity()
export class Regex {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Bank, { onDelete: 'CASCADE' })
  bank: Bank;

  @Column({ type: 'json' })
  pattern: Record<string, string>; // JSON object with regex patterns for different fields

  // New: deterministic hash of the pattern JSON for caching/auditing reuse
  @Column({ type: 'varchar', length: 128, unique: true, nullable: true })
  patternHash: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidenceScore: number; // Score from audit LLM

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: RegexCreatedBy,
    default: RegexCreatedBy.LLM,
  })
  createdBy: RegexCreatedBy;

  @Column({
    type: 'enum',
    enum: RegexAuditStatus,
    default: RegexAuditStatus.PENDING,
  })
  auditStatus: RegexAuditStatus;

  @Column({ type: 'text', nullable: true })
  auditNotes: string;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
