import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sdp_logs' })
export class SdpLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ name: 'external_service_id', type: 'varchar', length: 100, nullable: true })
  externalServiceId: string | null;

  @Index()
  @Column({ name: 'request_id', type: 'varchar', length: 200, nullable: true })
  requestId: string | null;

  @Column({ name: 'request_timestamp', type: 'varchar', length: 100, nullable: true })
  requestTimeStamp: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  channel: string | null;

  @Column({ name: 'feature_id', type: 'varchar', length: 50, nullable: true })
  featureId: string | null;

  @Column({ name: 'plan_id', type: 'varchar', length: 50, nullable: true })
  planId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  command: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  msisdn: string | null;

  @Column({ name: 'offer_code', type: 'varchar', length: 50, nullable: true })
  offerCode: string | null;

  @Column({
    name: 'charge_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  chargeAmount: string;

  @Column({ name: 'subscription_status', type: 'varchar', length: 50, nullable: true })
  subscriptionStatus: string | null;

  @Column({
    name: 'subscriber_life_cycle',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  subscriberLifeCycle: string | null;

  @Index()
  @Column({ name: 'transaction_id', type: 'varchar', length: 200, nullable: true })
  transactionId: string | null;

  @Column({ name: 'next_billing_date', type: 'varchar', length: 50, nullable: true })
  nextBillingDate: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'normalized_status', type: 'varchar', length: 50, nullable: true })
  normalizedStatus: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  operator: string | null;

  @Index()
  @Column({
    name: 'callback_timestamp',
    type: 'timestamp',
    default: () => 'NOW()',
  })
  callbackTimestamp: Date;

  @Column({ name: 'payload_json', type: 'jsonb', nullable: true })
  payloadJson: Record<string, unknown> | null;

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
