import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Token } from '../../tokens/entities/token.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  // Make password optional to support OAuth users
  @Column({ nullable: true, type: 'text' })
  password: string | null;

  @Column()
  name: string;

  // Provider info to distinguish local vs social accounts
  @Column({ default: 'local' })
  provider: 'local' | 'google';

  // Google subject (user id) if linked
  @Column({ unique: true, nullable: true, type: 'text' })
  googleId: string | null;

  // Optional profile picture
  @Column({ nullable: true, type: 'text' })
  picture: string | null;

  // Email linked to the user
  @Column()
  emailLinked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Token, (token) => token.user)
  tokens: Token[];
}
