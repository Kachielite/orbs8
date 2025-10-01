import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { Account } from '../../account/entities/account.entity';

@Entity()
export class Currency {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column()
  code: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Transaction, (transaction) => transaction.currency)
  transactions: Transaction[];

  @OneToMany(() => Account, (account) => account.currency)
  accounts: Account[];
}
