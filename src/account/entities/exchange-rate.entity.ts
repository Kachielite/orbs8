import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Unique(['quotes'])
export class ExchangeRate {
  @PrimaryGeneratedColumn()
  id: number;

  // Currency pair in the form BASEQUOTE e.g., USDEUR
  @Column({ type: 'varchar', length: 16 })
  quotes: string;

  // Latest known rate for the pair
  @Column({ type: 'decimal', precision: 18, scale: 8 })
  rate: string;

  // When the rate was last successfully updated
  @Column({ type: 'timestamptz', nullable: true })
  lastUpdated: Date | null;

  // Whether the rate has been updated for the current update window
  @Column({ type: 'boolean', default: false })
  wasUpdated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
