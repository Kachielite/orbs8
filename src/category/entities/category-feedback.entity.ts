import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Category } from './category.entity';
import { User } from '../../auth/entities/user.entity';

@Entity()
export class CategoryFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  commonName: string;

  @ManyToOne(() => Category)
  category: Category;

  @ManyToOne(() => User)
  user: User;

  @Column({ default: false })
  appliedToAll: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
