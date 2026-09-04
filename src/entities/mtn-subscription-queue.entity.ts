import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MtnSubscriptionBatch } from './mtn-subscription-batch.entity';

export type MtnQueueStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

@Entity({ name: 'mtn_subscription_queue' })
export class MtnSubscriptionQueue {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'batch_id', type: 'bigint' })
  batchId: string;

  @ManyToOne(() => MtnSubscriptionBatch, (b) => b.queueItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batch_id' })
  batch: MtnSubscriptionBatch;

  @Column({ type: 'varchar', length: 20 })
  msisdn: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 8, unique: true })
  transactionId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: MtnQueueStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'status_code', type: 'varchar', length: 20, nullable: true })
  statusCode: string | null;

  @Column({ name: 'status_message', type: 'text', nullable: true })
  statusMessage: string | null;

  @Column({
    name: 'amount_charged',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  amountCharged: string;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'plan_id', type: 'varchar', length: 50, nullable: true })
  planId: string | null;

  @Column({
    name: 'callback_transaction_id',
    type: 'bigint',
    nullable: true,
  })
  callbackTransactionId: string | null;

  @Column({
    name: 'subscription_misdn_id',
    type: 'bigint',
    nullable: true,
  })
  subscriptionMisdnId: string | null;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
