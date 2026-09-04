import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  MTN_CALLBACK_AUTO_ENABLED,
  MTN_CALLBACK_AUTO_INTERVAL_MS,
} from './mtn.constants';
import { MtnCallbackAutoSubscribeService } from './mtn-callback-auto-subscribe.service';

@Injectable()
export class MtnCallbackAutoSubscribeProcessor implements OnModuleInit {
  private readonly logger = new Logger(MtnCallbackAutoSubscribeProcessor.name);

  constructor(
    private readonly callbackAutoService: MtnCallbackAutoSubscribeService,
  ) {}

  onModuleInit(): void {
    if (MTN_CALLBACK_AUTO_ENABLED) {
      this.logger.log(
        `Callback auto-subscribe enabled (interval ${MTN_CALLBACK_AUTO_INTERVAL_MS}ms)`,
      );
    } else {
      this.logger.warn('Callback auto-subscribe is disabled');
    }
  }

  @Interval(MTN_CALLBACK_AUTO_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (!MTN_CALLBACK_AUTO_ENABLED) return;

    const result = await this.callbackAutoService.runOnce();
    if (result.enqueued > 0) {
      this.logger.log(
        `Callback auto cron enqueued=${result.enqueued} batch=${result.batchId} position=${result.offsetPosition} offset=${result.offset}`,
      );
    }
  }
}
