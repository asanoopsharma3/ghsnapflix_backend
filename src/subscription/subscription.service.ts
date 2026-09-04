import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CgwSubscriber } from '../entities/cgw-subscriber.entity';
import { SUBSCRIPTION_CYCLE_MS } from '../cgw/cgw.constants';
import { createCgwToken } from '../cgw/cgw-token.util';
import { normalizeMsisdn } from '../cgw/cgw.config';

export type SubscriptionSummary = {
  subscriptionStatus: string;
  quizAccessStatus: 'topup_required' | 'available';
  questionsPlayedToday: number;
  questionsRemaining: number;
  dailyQuestionLimit: number;
  subscriptionStartTime: Date | null;
  nextPlayTime: Date | null;
  canPlay: boolean;
  message?: string;
};

const DAILY_QUESTION_LIMIT = 10;

@Injectable()
export class SubscriptionAccessService {
  constructor(
    @InjectRepository(CgwSubscriber)
    private readonly subscriberRepo: Repository<CgwSubscriber>,
  ) {}

  async activateByMsisdn(msisdn: unknown): Promise<CgwSubscriber> {
    const normalized = normalizeMsisdn(msisdn);
    if (!normalized || normalized.length < 12) {
      throw new Error('Invalid MSISDN format. Expected format: 233XXXXXXXXX');
    }

    const phone = `+${normalized}`;
    let user = await this.subscriberRepo.findOne({
      where: [{ phone }, { phone: normalized }],
    });
    if (!user) {
      user = this.subscriberRepo.create({ phone });
    }

    user.subscriptionStatus = 'active';
    user.isAttemptQuiz = false;
    if (!user.subscriptionStartTime) {
      user.subscriptionStartTime = new Date();
      user.nextPlayTime = new Date(Date.now() + SUBSCRIPTION_CYCLE_MS);
    }

    return this.subscriberRepo.save(user);
  }

  createToken(userId: string, secret: string): string {
    return createCgwToken(userId, secret);
  }

  getSummary(user: CgwSubscriber): SubscriptionSummary {
    const used = Math.min(
      Math.max(Number(user.questionsPlayedToday || 0), 0),
      DAILY_QUESTION_LIMIT,
    );
    const active = user.subscriptionStatus === 'active';

    return {
      subscriptionStatus: user.subscriptionStatus || 'inactive',
      quizAccessStatus: user.isAttemptQuiz ? 'topup_required' : 'available',
      questionsPlayedToday: used,
      questionsRemaining: Math.max(DAILY_QUESTION_LIMIT - used, 0),
      dailyQuestionLimit: DAILY_QUESTION_LIMIT,
      subscriptionStartTime: user.subscriptionStartTime || null,
      nextPlayTime: user.nextPlayTime || null,
      canPlay: active && !user.isAttemptQuiz,
      message: active ? undefined : 'Please subscribe to continue.',
    };
  }
}
