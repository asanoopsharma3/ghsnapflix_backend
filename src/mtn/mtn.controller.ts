import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import { MtnBatchService } from './mtn-batch.service';
import { MtnCallbackAutoSubscribeService } from './mtn-callback-auto-subscribe.service';
import { MtnQueueService } from './mtn-queue.service';
import { mtnExcelUploadOptions } from './mtn-upload.config';

@Controller('mtn/subscriptions')
export class MtnController {
  constructor(
    private readonly batchService: MtnBatchService,
    private readonly callbackAutoService: MtnCallbackAutoSubscribeService,
    private readonly queueService: MtnQueueService,
  ) {}

  /** Upload Excel → save under storage/uploads/mtn/, create batch (pending). */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', mtnExcelUploadOptions))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const batch = await this.batchService.createBatchFromUpload(file);
    return {
      ok: true,
      batch: {
        id: batch.id,
        originalFilename: batch.originalFilename,
        filePath: batch.filePath,
        totalCount: batch.totalCount,
        status: batch.status,
        createdAt: batch.createdAt,
      },
      message:
        'File stored. Call POST /mtn/subscriptions/batches/:id/subscribe to start.',
    };
  }

  /** Start MTN subscription API calls for a stored batch. */
  @Post('batches/:id/subscribe')
  async subscribeBatch(@Param('id') id: string) {
    const batch = await this.batchService.startSubscription(id);
    const processing = await this.queueService.processAllPending();
    const batchAfter = await this.batchService.getBatch(batch.id);
    const queueSummary = await this.batchService.getBatchQueueSummary(id);

    return {
      ok: true,
      batch: {
        id: batchAfter.id,
        filePath: batchAfter.filePath,
        totalCount: batchAfter.totalCount,
        processedCount: batchAfter.processedCount,
        successCount: batchAfter.successCount,
        failedCount: batchAfter.failedCount,
        status: batchAfter.status,
      },
      queueSummary,
      processing,
      message: 'All batch rows processed.',
    };
  }

  @Get('batches')
  async listBatches(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const batches = await this.batchService.listBatches(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
    return { ok: true, batches };
  }

  @Get('batches/:id')
  async getBatch(@Param('id') id: string) {
    const batch = await this.batchService.getBatch(id);
    const queueSummary = await this.batchService.getBatchQueueSummary(id);
    return { ok: true, batch, queueSummary };
  }

  @Get('batches/:id/file')
  async downloadBatchFile(@Param('id') id: string, @Res() res: Response) {
    const batch = await this.batchService.getBatch(id);
    const absolutePath = this.batchService.resolveBatchFilePath(batch);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        ok: false,
        message: `File not found: ${batch.filePath}`,
      });
    }

    return res.download(absolutePath, batch.originalFilename);
  }

  @Get('queue/stats')
  async queueStats() {
    const stats = await this.queueService.getQueueStats();
    return { ok: true, stats };
  }

  @Post('queue/process')
  async processQueueNow() {
    const result = await this.queueService.processAllPending();
    return { ok: true, ...result };
  }

  /** Stats for callback_transactions auto-subscription cron. */
  @Get('callback-auto/stats')
  async callbackAutoStats() {
    const stats = await this.callbackAutoService.getStats();
    return { ok: true, stats };
  }

  /** Manually trigger one callback auto-subscription fetch + enqueue run. */
  @Post('callback-auto/run')
  async callbackAutoRun() {
    const result = await this.callbackAutoService.runOnce();
    return result;
  }
}
