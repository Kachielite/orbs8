import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Category } from '../../category/entities/category.entity';
import { Currency } from '../../currency/entities/currency.entity';
import { Account } from '../../account/entities/account.entity';
import { Regex } from '../../regex/entities/regex.entity';

export enum TransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
  REFUND = 'refund',
  CHARGEBACK = 'chargeback',
  PAYMENT = 'payment',
  WITHDRAWAL = 'withdrawal',
  REVERSAL = 'reversal',
  OTHER = 'other',
}

// New: Track extraction method
export enum ExtractionMethod {
  LLM = 'LLM',
  REGEX = 'REGEX',
  MANUAL = 'MANUAL',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.OTHER,
  })
  type: TransactionType;

  @Column()
  description: string;

  @Column()
  transactionID: string;

  @Column()
  transactionDate: Date;

  // New: extraction method and optional regex reference
  @Column({ type: 'enum', enum: ExtractionMethod, default: ExtractionMethod.LLM })
  extractionMethod: ExtractionMethod;

  @ManyToOne(() => Regex, { nullable: true, onDelete: 'SET NULL' })
  regex?: Regex | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  category: Category;

  @ManyToOne(() => Currency, { onDelete: 'CASCADE' })
  currency: Currency;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  account: Account;
}
