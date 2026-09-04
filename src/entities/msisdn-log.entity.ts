import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'msisdn_logs' })
export class MsisdnLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  msisdn: string | null;

  @Column({ type: 'varchar', length: 20, default: 'HE' })
  source: string;

  @Column({ name: 'offer_code', type: 'varchar', length: 50, nullable: true })
  offerCode: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
