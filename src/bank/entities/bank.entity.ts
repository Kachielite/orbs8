import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from '../../account/entities/account.entity';

@Entity()
export class Bank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Account, (account) => account.bank)
  accounts: Account[];
}
