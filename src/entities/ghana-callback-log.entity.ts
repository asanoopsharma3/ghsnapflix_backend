import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GhanaCallbackType = 'SDP' | 'CGW';
export type GhanaCallbackFlow = 'HE' | 'NHE' | 'UNKNOWN';

@Entity({ name: 'ghana_callback_logs' })
export class GhanaCallbackLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index()
  @Column({ name: 'callback_type', type: 'varchar', length: 10 })
  callbackType: GhanaCallbackType;

  @Column({ type: 'varchar', length: 10, default: 'UNKNOWN' })
  flow: GhanaCallbackFlow;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  msisdn: string | null;

  @Column({ name: 'offer_code', type: 'varchar', length: 50, nullable: true })
  offerCode: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string | null;

  @Column({ name: 'normalized_status', type: 'varchar', length: 50, nullable: true })
  normalizedStatus: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lifecycle: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cgid: string | null;

  @Column({
    name: 'charging_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  chargingAmount: string;

  @Column({ name: 'raw_query', type: 'jsonb', nullable: true })
  rawQuery: Record<string, unknown> | null;

  @Column({ name: 'raw_body', type: 'jsonb', nullable: true })
  rawBody: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  headers: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
