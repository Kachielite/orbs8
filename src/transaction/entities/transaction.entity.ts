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

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
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
