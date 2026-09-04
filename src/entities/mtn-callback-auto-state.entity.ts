import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'mtn_callback_auto_state' })
export class MtnCallbackAutoState {
  @PrimaryColumn({ type: 'smallint', default: 1 })
  id: number;

  /** Rotates 0=start, 1=middle, 2=end on each cron run. */
  @Column({ name: 'offset_index', type: 'smallint', default: 0 })
  offsetIndex: number;

  /** Rotates which requestedPlan filter to use on each cron run. */
  @Column({ name: 'requested_plan_index', type: 'smallint', default: 0 })
  requestedPlanIndex: number;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
