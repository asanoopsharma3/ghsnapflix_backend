import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MTN_QUEUE_ENABLED, MTN_QUEUE_INTERVAL_MS } from './mtn.constants';
import { MtnQueueService } from './mtn-queue.service';

@Injectable()
export class MtnQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(MtnQueueProcessor.name);

  constructor(private readonly queueService: MtnQueueService) {}

  onModuleInit(): void {
    if (MTN_QUEUE_ENABLED) {
      this.logger.log(
        `MTN queue processor enabled (interval ${MTN_QUEUE_INTERVAL_MS}ms)`,
      );
    } else {
      this.logger.warn('MTN queue processor is disabled');
    }
  }

  @Interval(MTN_QUEUE_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (!MTN_QUEUE_ENABLED) return;
    await this.queueService.processNextChunk();
  }
}
