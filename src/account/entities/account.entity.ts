import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Bank } from '../../bank/entities/bank.entity';
import { Currency } from '../../currency/entities/currency.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { User } from '../../auth/entities/user.entity';

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  accountName: string;

  @Column()
  accountNumber: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  currentBalance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Bank)
  bank: Bank;

  @ManyToOne(() => Currency)
  currency: Currency;

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions: Transaction[];
}
