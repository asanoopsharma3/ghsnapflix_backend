import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallbackTransaction } from '../entities/callback-transaction.entity';
import { MtnCallbackAutoState } from '../entities/mtn-callback-auto-state.entity';
import { MtnBatchService } from './mtn-batch.service';
import { MTN_CALLBACK_AUTO_FETCH_LIMIT, MTN_CALLBACK_ROTATE_REQUESTED_PLAN_ORDER } from './mtn.constants';
import {
  getRotatingRequestedPlan,
  resolveCallbackAutoSubscribePlanId,
} from './mtn-plan.util';

export type CallbackOffsetPosition = 'start' | 'middle' | 'end';

const OFFSET_POSITIONS: CallbackOffsetPosition[] = ['start', 'middle', 'end'];

export type CallbackAutoRunResult = {
  ok: boolean;
  fetched: number;
  enqueued: number;
  skipped: number;
  eligibleCount: number;
  offset: number;
  offsetPosition: CallbackOffsetPosition;
  requestedPlan: string;
  subscribePlanId: string;
  batchId: string | null;
  message: string;
};

@Injectable()
export class MtnCallbackAutoSubscribeService {
  private readonly logger = new Logger(MtnCallbackAutoSubscribeService.name);
  private running = false;

  constructor(
    private readonly batchService: MtnBatchService,
    @InjectRepository(CallbackTransaction)
    private readonly callbackRepo: Repository<CallbackTransaction>,
    @InjectRepository(MtnCallbackAutoState)
    private readonly stateRepo: Repository<MtnCallbackAutoState>,
  ) {}

  async runOnce(
    limit = MTN_CALLBACK_AUTO_FETCH_LIMIT,
  ): Promise<CallbackAutoRunResult> {
    if (this.running) {
      return {
        ok: true,
        fetched: 0,
        enqueued: 0,
        skipped: 0,
        eligibleCount: 0,
        offset: 0,
        offsetPosition: 'start',
        requestedPlan: MTN_CALLBACK_ROTATE_REQUESTED_PLAN_ORDER[0],
        subscribePlanId: '',
        batchId: null,
        message: 'Previous callback auto run still in progress',
      };
    }

    this.running = true;

    try {
      const state = await this.getOrCreateState();
      const offsetPosition = OFFSET_POSITIONS[state.offsetIndex] ?? 'start';
      const requestedPlan = getRotatingRequestedPlan(state.requestedPlanIndex);
      const subscribePlanId =
        resolveCallbackAutoSubscribePlanId(requestedPlan) ?? '';
      const eligibleCount =
        await this.countEligibleTransactions(requestedPlan, subscribePlanId);

      if (!subscribePlanId) {
        await this.advanceState(state);
        return {
          ok: true,
          fetched: 0,
          enqueued: 0,
          skipped: 0,
          eligibleCount: 0,
          offset: 0,
          offsetPosition,
          requestedPlan,
          subscribePlanId: '',
          batchId: null,
          message: `Unknown requestedPlan mapping for ${requestedPlan}`,
        };
      }

      if (eligibleCount === 0) {
        await this.advanceState(state);
        return {
          ok: true,
          fetched: 0,
          enqueued: 0,
          skipped: 0,
          eligibleCount: 0,
          offset: 0,
          offsetPosition,
          requestedPlan,
          subscribePlanId,
          batchId: null,
          message: `No eligible rows for requestedPlan ${requestedPlan} → subscribe ${subscribePlanId}`,
        };
      }

      const offset = this.resolveOffset(offsetPosition, eligibleCount, limit);
      const transactions = await this.fetchEligibleTransactions(
        offset,
        limit,
        requestedPlan,
        subscribePlanId,
      );
      const queuedMsisdnPlans =
        await this.getQueuedCallbackMsisdnPlans(subscribePlanId);
      const seenInBatch = new Set<string>();

      const rows: {
        msisdn: string;
        planId: string;
        callbackTransactionId: string;
      }[] = [];
      let skipped = 0;

      for (const tx of transactions) {
        const msisdn = this.resolveMsisdn(tx);

        if (!msisdn || !subscribePlanId) {
          skipped++;
          continue;
        }

        const msisdnPlanKey = `${msisdn}|${subscribePlanId}`;
        if (queuedMsisdnPlans.has(msisdnPlanKey) || seenInBatch.has(msisdnPlanKey)) {
          skipped++;
          continue;
        }

        seenInBatch.add(msisdnPlanKey);
        rows.push({
          msisdn,
          planId: subscribePlanId,
          callbackTransactionId: tx.id,
        });
      }

      if (!rows.length) {
        await this.advanceState(state);
        return {
          ok: true,
          fetched: transactions.length,
          enqueued: 0,
          skipped,
          eligibleCount,
          offset,
          offsetPosition,
          requestedPlan,
          subscribePlanId,
          batchId: null,
          message: 'Fetched rows had no valid msisdn/plan_id',
        };
      }

      const batch = await this.batchService.createBatchFromCallbackRows(rows);
      await this.advanceState(state);

      this.logger.log(
        `Callback auto run: requestedPlan=${requestedPlan} subscribePlan=${subscribePlanId} position=${offsetPosition} offset=${offset} eligible=${eligibleCount} enqueued=${rows.length} batch=${batch.id}`,
      );

      return {
        ok: true,
        fetched: transactions.length,
        enqueued: rows.length,
        skipped,
        eligibleCount,
        offset,
        offsetPosition,
        requestedPlan,
        subscribePlanId,
        batchId: batch.id,
        message: 'Callback rows enqueued for subscription',
      };
    } finally {
      this.running = false;
    }
  }

  async getStats(): Promise<{
    eligibleCount: number;
    eligibleByRequestedPlan: Record<string, number>;
    offsetIndex: number;
    offsetPosition: CallbackOffsetPosition;
    requestedPlanIndex: number;
    requestedPlan: string;
    subscribePlanId: string;
    lastRunAt: Date | null;
    queuedFromCallback: number;
  }> {
    const state = await this.getOrCreateState();
    const requestedPlan = getRotatingRequestedPlan(state.requestedPlanIndex);
    const subscribePlanId =
      resolveCallbackAutoSubscribePlanId(requestedPlan) ?? '';

    const eligibleByRequestedPlan: Record<string, number> = {};
    for (const plan of MTN_CALLBACK_ROTATE_REQUESTED_PLAN_ORDER) {
      const subscribePlan =
        resolveCallbackAutoSubscribePlanId(plan) ?? '';
      eligibleByRequestedPlan[plan] = subscribePlan
        ? await this.countEligibleTransactions(plan, subscribePlan)
        : 0;
    }

    const eligibleCount = eligibleByRequestedPlan[requestedPlan] ?? 0;
    const queuedFromCallback = await this.callbackRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('mtn_subscription_queue', 'q')
      .where('q.callback_transaction_id IS NOT NULL')
      .getRawOne<{ count: string }>();

    return {
      eligibleCount,
      eligibleByRequestedPlan,
      offsetIndex: state.offsetIndex,
      offsetPosition: OFFSET_POSITIONS[state.offsetIndex] ?? 'start',
      requestedPlanIndex: state.requestedPlanIndex,
      requestedPlan,
      subscribePlanId,
      lastRunAt: state.lastRunAt,
      queuedFromCallback: parseInt(queuedFromCallback?.count ?? '0', 10),
    };
  }

  private async getOrCreateState(): Promise<MtnCallbackAutoState> {
    let state = await this.stateRepo.findOne({ where: { id: 1 } });
    if (!state) {
      state = await this.stateRepo.save({
        id: 1,
        offsetIndex: 0,
        requestedPlanIndex: 0,
      });
    }
    return state;
  }

  private async advanceState(state: MtnCallbackAutoState): Promise<void> {
    const planCount = MTN_CALLBACK_ROTATE_REQUESTED_PLAN_ORDER.length;
    await this.stateRepo.update(1, {
      offsetIndex: (state.offsetIndex + 1) % OFFSET_POSITIONS.length,
      requestedPlanIndex: (state.requestedPlanIndex + 1) % planCount,
      lastRunAt: new Date(),
    });
  }

  private resolveOffset(
    position: CallbackOffsetPosition,
    total: number,
    limit: number,
  ): number {
    if (total <= limit) return 0;

    switch (position) {
      case 'middle':
        return Math.floor((total - limit) / 2);
      case 'end':
        return Math.max(0, total - limit);
      case 'start':
      default:
        return 0;
    }
  }

  private callbackMsisdnMatchesSql(
    callbackAlias: string,
    targetAlias: string,
  ): string {
    return `(
      (${callbackAlias}.msisdn IS NOT NULL AND ${targetAlias}.msisdn = regexp_replace(regexp_replace(${callbackAlias}.msisdn, '[^0-9+]', '', 'g'), '^\\+', ''))
      OR (${callbackAlias}.callingParty IS NOT NULL AND ${targetAlias}.msisdn = regexp_replace(regexp_replace(${callbackAlias}.callingParty, '[^0-9+]', '', 'g'), '^\\+', ''))
    )`;
  }

  private eligibleQuery(requestedPlan: string, subscribePlanId: string) {
    const msisdnMatchesQueue = this.callbackMsisdnMatchesSql('ct', 'q');
    const msisdnMatchesSub = this.callbackMsisdnMatchesSql('ct', 'sm');

    return this.callbackRepo
      .createQueryBuilder('ct')
      .where('ct.result IS NOT NULL')
      .andWhere("TRIM(ct.result) <> ''")
      .andWhere("ct.result NOT ILIKE :successResult", {
        successResult: '%Success%',
      })
      .andWhere('ct.requestedPlan IS NOT NULL')
      .andWhere("TRIM(ct.requestedPlan) <> ''")
      .andWhere(
        `regexp_replace(TRIM(ct.requestedPlan), '_R$', '', 'i') = :requestedPlan`,
        { requestedPlan },
      )
      .andWhere('(ct.msisdn IS NOT NULL OR ct.callingParty IS NOT NULL)')
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM mtn_subscription_queue q
          WHERE q.callback_transaction_id = ct.id
        )`,
      )
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM mtn_subscription_queue q
          WHERE q.callback_transaction_id IS NOT NULL
          AND q.plan_id = :subscribePlanId
          AND ${msisdnMatchesQueue}
        )`,
        { subscribePlanId },
      )
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM subscription_misdns sm
          WHERE sm.plan_id = :subscribePlanId
          AND sm.status_code = '0000'
          AND ${msisdnMatchesSub}
        )`,
        { subscribePlanId },
      );
  }

  private async getQueuedCallbackMsisdnPlans(
    subscribePlanId: string,
  ): Promise<Set<string>> {
    const rows = await this.callbackRepo.manager
      .createQueryBuilder()
      .select('q.msisdn', 'msisdn')
      .addSelect('q.plan_id', 'planId')
      .from('mtn_subscription_queue', 'q')
      .where('q.callback_transaction_id IS NOT NULL')
      .andWhere('q.plan_id = :subscribePlanId', { subscribePlanId })
      .getRawMany<{ msisdn: string; planId: string }>();

    return new Set(
      rows
        .filter((row) => row.msisdn && row.planId)
        .map((row) => `${row.msisdn}|${row.planId}`),
    );
  }

  private async countEligibleTransactions(
    requestedPlan: string,
    subscribePlanId: string,
  ): Promise<number> {
    if (!subscribePlanId) return 0;
    return this.eligibleQuery(requestedPlan, subscribePlanId).getCount();
  }

  private async fetchEligibleTransactions(
    offset: number,
    limit: number,
    requestedPlan: string,
    subscribePlanId: string,
  ): Promise<CallbackTransaction[]> {
    return this.eligibleQuery(requestedPlan, subscribePlanId)
      .orderBy('ct.id', 'ASC')
      .skip(offset)
      .take(limit)
      .getMany();
  }

  private resolveMsisdn(tx: CallbackTransaction): string | null {
    return this.normalizeMsisdn(tx.msisdn ?? tx.callingParty);
  }

  private normalizeMsisdn(value: unknown): string | null {
    if (value === undefined || value === null) return null;

    let s = String(value).trim();
    if (!s) return null;

    if (/^[\d.]+e\+?\d+$/i.test(s)) {
      const n = Number(s);
      if (!Number.isNaN(n) && Number.isFinite(n)) {
        s = String(Math.trunc(n));
      }
    }

    s = s.replace(/[^\d+]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    s = s.replace(/\D/g, '');

    if (s.length < 8 || s.length > 20) return null;
    return s;
  }
}
