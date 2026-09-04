import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MtnSubscriptionQueue } from './mtn-subscription-queue.entity';

export type MtnBatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type MtnBatchSourceType = 'excel' | 'callback_auto';

@Entity({ name: 'mtn_subscription_batches' })
export class MtnSubscriptionBatch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({ name: 'total_count', type: 'integer', default: 0 })
  totalCount: number;

  @Column({ name: 'processed_count', type: 'integer', default: 0 })
  processedCount: number;

  @Column({ name: 'success_count', type: 'integer', default: 0 })
  successCount: number;

  @Column({ name: 'failed_count', type: 'integer', default: 0 })
  failedCount: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: MtnBatchStatus;

  @Column({ name: 'source_type', type: 'varchar', length: 20, default: 'excel' })
  sourceType: MtnBatchSourceType;

  @OneToMany(() => MtnSubscriptionQueue, (q) => q.batch)
  queueItems: MtnSubscriptionQueue[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
