import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CgwSubscriptionStatus = 'inactive' | 'active' | 'suspended';

@Entity({ name: 'cgw_subscribers' })
export class CgwSubscriber {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  phone: string;

  @Column({
    name: 'subscription_status',
    type: 'varchar',
    length: 20,
    default: 'inactive',
  })
  subscriptionStatus: CgwSubscriptionStatus;

  @Column({ name: 'is_attempt_quiz', type: 'boolean', default: false })
  isAttemptQuiz: boolean;

  @Column({ name: 'questions_played_today', type: 'integer', default: 0 })
  questionsPlayedToday: number;

  @Column({ name: 'subscription_start_time', type: 'timestamp', nullable: true })
  subscriptionStartTime: Date | null;

  @Column({ name: 'next_play_time', type: 'timestamp', nullable: true })
  nextPlayTime: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
