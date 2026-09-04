import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CgwCallbackLogType = 'CGW' | 'SDP';

@Entity({ name: 'cgw_callback_logs' })
export class CgwCallbackLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 10, default: 'CGW' })
  type: CgwCallbackLogType;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  msisdn: string | null;

  @Column({ name: 'offer_code', type: 'varchar', length: 50, nullable: true })
  offerCode: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lifecycle: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cgid: string | null;

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
