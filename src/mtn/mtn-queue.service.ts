import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MtnSubscriptionQueue } from '../entities/mtn-subscription-queue.entity';
import { MtnBatchService } from './mtn-batch.service';
import { MTN_QUEUE_CHUNK_SIZE } from './mtn.constants';
import { MtnSubscriptionService } from './mtn-subscription.service';

const MAX_ATTEMPTS = 3;

@Injectable()
export class MtnQueueService {
  private readonly logger = new Logger(MtnQueueService.name);
  private processing = false;

  constructor(
    private readonly batchService: MtnBatchService,
    private readonly subscriptionService: MtnSubscriptionService,
    @InjectRepository(MtnSubscriptionQueue)
    private readonly queueRepo: Repository<MtnSubscriptionQueue>,
  ) {}

  async processNextChunk(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (this.processing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.processing = true;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const touchedBatches = new Set<string>();

    try {
      const jobs = await this.queueRepo
        .createQueryBuilder('q')
        .innerJoin('q.batch', 'b')
        .where('q.status = :status', { status: 'pending' })
        .andWhere('b.status = :batchStatus', { batchStatus: 'processing' })
        .orderBy('q.id', 'ASC')
        .take(MTN_QUEUE_CHUNK_SIZE)
        .getMany();

      if (!jobs.length) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      for (const job of jobs) {
        const claimed = await this.queueRepo.update(
          { id: job.id, status: 'pending' },
          { status: 'processing', attempts: job.attempts + 1 },
        );

        if (!claimed.affected) continue;

        touchedBatches.add(job.batchId);
        processed++;

        try {
          if (!job.planId) {
            await this.queueRepo.update(job.id, {
              status: 'failed',
              errorMessage: 'plan_id is required (upload Excel with misdn and plan_id columns)',
              processedAt: new Date(),
            });
            failed++;
            continue;
          }

          const { result, subscriptionMisdnId } =
            await this.subscriptionService.subscribeAndSave(
              job.msisdn,
              job.transactionId,
              job.planId,
            );

          await this.queueRepo.update(job.id, {
            status: result.ok ? 'completed' : 'failed',
            statusCode: result.statusCode,
            statusMessage: result.statusMessage,
            amountCharged: result.amountCharged,
            responsePayload: result.response
              ? (result.response as object)
              : null,
            errorMessage: result.errorMessage,
            subscriptionMisdnId,
            processedAt: new Date(),
          });

          if (result.ok) succeeded++;
          else failed++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const shouldRetry = job.attempts + 1 < MAX_ATTEMPTS;

          await this.queueRepo.update(job.id, {
            status: shouldRetry ? 'pending' : 'failed',
            errorMessage: message,
            processedAt: shouldRetry ? null : new Date(),
          });

          if (!shouldRetry) failed++;

          this.logger.error(
            `Queue job ${job.id} msisdn=${job.msisdn} error: ${message}`,
          );
        }
      }
    } finally {
      this.processing = false;
    }

    for (const batchId of touchedBatches) {
      await this.batchService.refreshBatchCounters(batchId);
    }

    if (processed > 0) {
      this.logger.log(
        `Queue chunk done: processed=${processed} succeeded=${succeeded} failed=${failed}`,
      );
    }

    return { processed, succeeded, failed };
  }

  /** Process queue until no pending jobs remain (all batch rows). */
  async processAllPending(maxRounds = 500): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    rounds: number;
  }> {
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let rounds = 0;

    while (rounds < maxRounds) {
      const round = await this.processNextChunk();
      if (round.processed === 0) break;

      processed += round.processed;
      succeeded += round.succeeded;
      failed += round.failed;
      rounds++;
    }

    if (processed > 0) {
      this.logger.log(
        `Queue drain done: processed=${processed} succeeded=${succeeded} failed=${failed} rounds=${rounds}`,
      );
    }

    return { processed, succeeded, failed, rounds };
  }

  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const rows = await this.queueRepo
      .createQueryBuilder('q')
      .select('q.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('q.status')
      .getRawMany<{ status: string; count: string }>();

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of rows) {
      const key = row.status as keyof typeof stats;
      if (key in stats) stats[key] = parseInt(row.count, 10);
    }

    return stats;
  }
}
