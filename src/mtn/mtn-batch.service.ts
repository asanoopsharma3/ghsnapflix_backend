import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import {
  MtnSubscriptionBatch,
  MtnBatchStatus,
  MtnBatchSourceType,
} from '../entities/mtn-subscription-batch.entity';
import { MtnSubscriptionQueue } from '../entities/mtn-subscription-queue.entity';
import { MtnExcelService } from './mtn-excel.service';
import { MTN_ENQUEUE_CHUNK_SIZE } from './mtn.constants';
import { generateUniqueMtnRequestTransactionIds } from './mtn-transaction-id.util';
import {
  resolveStoragePath,
  toRelativeStoragePath,
} from './mtn-storage.util';

const MAX_MSISDN_PER_BATCH = 20000;

@Injectable()
export class MtnBatchService {
  private readonly logger = new Logger(MtnBatchService.name);

  constructor(
    private readonly excelService: MtnExcelService,
    @InjectRepository(MtnSubscriptionBatch)
    private readonly batchRepo: Repository<MtnSubscriptionBatch>,
    @InjectRepository(MtnSubscriptionQueue)
    private readonly queueRepo: Repository<MtnSubscriptionQueue>,
  ) {}

  async createBatchFromUpload(
    file: Express.Multer.File,
  ): Promise<MtnSubscriptionBatch> {
    if (!file?.path) {
      throw new BadRequestException('No file uploaded');
    }

    const absolutePath = file.path;
    const storedPath = toRelativeStoragePath(absolutePath);

    const rows = this.excelService.readSubscriptionRowsFromFile(absolutePath);
    if (rows.length > MAX_MSISDN_PER_BATCH) {
      fs.unlinkSync(absolutePath);
      throw new BadRequestException(
        `Maximum ${MAX_MSISDN_PER_BATCH} MSISDNs allowed per upload`,
      );
    }

    const batch = await this.batchRepo.save({
      originalFilename: file.originalname,
      filePath: storedPath,
      totalCount: rows.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      status: 'pending' as MtnBatchStatus,
      sourceType: 'excel' as MtnBatchSourceType,
    });

    await this.enqueueRows(batch.id, rows);

    this.logger.log(
      `Batch ${batch.id} saved file=${storedPath} rows=${rows.length}`,
    );

    return this.getBatch(batch.id);
  }

  async startSubscription(batchId: string): Promise<MtnSubscriptionBatch> {
    const batch = await this.getBatch(batchId);

    if (batch.status === 'processing') {
      throw new BadRequestException(`Batch ${batchId} is already processing`);
    }

    if (batch.status === 'completed') {
      throw new BadRequestException(`Batch ${batchId} is already completed`);
    }

    if (batch.sourceType !== 'callback_auto') {
      const fileAbsolute = resolveStoragePath(batch.filePath);
      if (!fs.existsSync(fileAbsolute)) {
        throw new BadRequestException(
          `Stored Excel file not found: ${batch.filePath}`,
        );
      }
    }

    await this.batchRepo.update(batchId, { status: 'processing' });

    this.logger.log(`Batch ${batchId} subscription started`);

    return this.getBatch(batchId);
  }

  resolveBatchFilePath(batch: MtnSubscriptionBatch): string {
    return resolveStoragePath(batch.filePath);
  }

  async createBatchFromCallbackRows(
    rows: { msisdn: string; planId: string; callbackTransactionId: string }[],
  ): Promise<MtnSubscriptionBatch> {
    if (!rows.length) {
      throw new BadRequestException('No callback rows to enqueue');
    }

    const batch = await this.batchRepo.save({
      originalFilename: `callback-auto-${new Date().toISOString()}`,
      filePath: 'callback-auto/virtual',
      totalCount: rows.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      status: 'processing' as MtnBatchStatus,
      sourceType: 'callback_auto' as MtnBatchSourceType,
    });

    await this.enqueueRows(batch.id, rows);

    this.logger.log(
      `Callback auto batch ${batch.id} enqueued rows=${rows.length}`,
    );

    return this.getBatch(batch.id);
  }

  private async enqueueRows(
    batchId: string,
    rows: {
      msisdn: string;
      planId: string;
      callbackTransactionId?: string;
    }[],
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += MTN_ENQUEUE_CHUNK_SIZE) {
      const slice = rows.slice(i, i + MTN_ENQUEUE_CHUNK_SIZE);
      const transactionIds = generateUniqueMtnRequestTransactionIds(slice.length);
      const queueRows = slice.map((row, index) => ({
        batchId,
        msisdn: row.msisdn,
        planId: row.planId,
        callbackTransactionId: row.callbackTransactionId ?? null,
        transactionId: transactionIds[index],
        status: 'pending' as const,
        attempts: 0,
        amountCharged: '0.00',
      }));

      await this.queueRepo.insert(queueRows);
    }
  }

  async getBatch(id: string): Promise<MtnSubscriptionBatch> {
    const batch = await this.batchRepo.findOne({ where: { id } });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  async listBatches(limit = 20, offset = 0): Promise<MtnSubscriptionBatch[]> {
    return this.batchRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getBatchQueueSummary(batchId: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const rows = await this.queueRepo
      .createQueryBuilder('q')
      .select('q.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('q.batch_id = :batchId', { batchId })
      .groupBy('q.status')
      .getRawMany<{ status: string; count: string }>();

    const summary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of rows) {
      const key = row.status as keyof typeof summary;
      if (key in summary) summary[key] = parseInt(row.count, 10);
    }

    return summary;
  }

  async refreshBatchCounters(batchId: string): Promise<void> {
    const summary = await this.getBatchQueueSummary(batchId);
    const processed = summary.completed + summary.failed;
    const batch = await this.getBatch(batchId);

    let status: MtnBatchStatus = batch.status;
    if (summary.pending === 0 && summary.processing === 0) {
      status = summary.failed > 0 && summary.completed === 0 ? 'failed' : 'completed';
    } else if (summary.processing > 0 || summary.pending > 0) {
      status = 'processing';
    }

    await this.batchRepo.update(batchId, {
      processedCount: processed,
      successCount: summary.completed,
      failedCount: summary.failed,
      status,
    });
  }
}
