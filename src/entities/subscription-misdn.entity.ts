import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'subscription_misdns' })
export class SubscriptionMisdn {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** MSISDN from uploaded Excel (URL path). */
  @Column({ type: 'varchar', length: 20 })
  msisdn: string;

  /** plan_id from Excel → request subscriptionId. */
  @Column({ name: 'plan_id', type: 'varchar', length: 50 })
  planId: string;

  @Column({ name: 'log_time', type: 'timestamp' })
  logTime: Date;

  @Column({ name: 'status_code', type: 'varchar', length: 20, nullable: true })
  statusCode: string | null;

  /** Response 1: statusMessage. Response 2: may be absent (status holds message). */
  @Column({ name: 'status_message', type: 'text', nullable: true })
  statusMessage: string | null;

  /**
   * Response 1: status e.g. "0000".
   * Response 2: human-readable message e.g. "You have Already Subscribed...".
   */
  @Column({ type: 'text', nullable: true })
  status: string | null;

  /** Response 2: httpStatus e.g. "BAD_REQUEST". */
  @Column({ name: 'http_status', type: 'varchar', length: 50, nullable: true })
  httpStatus: string | null;

  @Column({ name: 'subscription_name', type: 'varchar', length: 100, nullable: true })
  subscriptionName: string | null;

  @Column({ name: 'registration_channel', type: 'varchar', length: 50, nullable: true })
  registrationChannel: string | null;

  @Column({
    name: 'amount_charged',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  amountCharged: string | null;

  @Column({ name: 'send_sms_notification', type: 'boolean', nullable: true })
  sendSmsNotification: boolean | null;

  @Column({ name: 'auto_renew', type: 'boolean', nullable: true })
  autoRenew: boolean | null;

  @Column({
    name: 'amount_before',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  amountBefore: string | null;

  @Column({
    name: 'amount_after',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  amountAfter: string | null;

  @Column({ name: 'non_gsm', type: 'boolean', nullable: true })
  nonGsm: boolean | null;

  /** Same as msisdn (Excel / request customer). */
  @Column({ name: 'customer_id', type: 'varchar', length: 20 })
  customerId: string;

  @Column({ type: 'boolean', nullable: true })
  cvmoffer: boolean | null;

  /** Response nodeId → service_node. */
  @Column({ name: 'service_node', type: 'varchar', length: 50, nullable: true })
  serviceNode: string | null;

  /** Full API response (response 3 / unknown shapes). */
  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
