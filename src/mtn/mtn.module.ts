import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallbackTransaction } from '../entities/callback-transaction.entity';
import { MtnCallbackAutoState } from '../entities/mtn-callback-auto-state.entity';
import { MtnSubscriptionBatch } from '../entities/mtn-subscription-batch.entity';
import { MtnSubscriptionQueue } from '../entities/mtn-subscription-queue.entity';
import { MtnTokenCache } from '../entities/mtn-token-cache.entity';
import { SubscriptionMisdn } from '../entities/subscription-misdn.entity';
import { MtnAuthService } from './mtn-auth.service';
import { MtnBatchService } from './mtn-batch.service';
import { MtnCallbackAutoSubscribeProcessor } from './mtn-callback-auto-subscribe.processor';
import { MtnCallbackAutoSubscribeService } from './mtn-callback-auto-subscribe.service';
import { MtnController } from './mtn.controller';
import { MtnExcelService } from './mtn-excel.service';
import { MtnOtpController } from './mtn-otp.controller';
import { MtnOtpService } from './mtn-otp.service';
import { MtnQueueProcessor } from './mtn-queue.processor';
import { MtnQueueService } from './mtn-queue.service';
import { MtnSmsService } from './mtn-sms.service';
import { MtnSubscribeController } from './mtn-subscribe.controller';
import { MtnSubscriptionService } from './mtn-subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CallbackTransaction,
      MtnCallbackAutoState,
      MtnSubscriptionBatch,
      MtnSubscriptionQueue,
      MtnTokenCache,
      SubscriptionMisdn,
    ]),
  ],
  controllers: [MtnController, MtnOtpController, MtnSubscribeController],
  providers: [
    MtnAuthService,
    MtnSmsService,
    MtnOtpService,
    MtnSubscriptionService,
    MtnExcelService,
    MtnBatchService,
    MtnCallbackAutoSubscribeService,
    MtnCallbackAutoSubscribeProcessor,
    MtnQueueService,
    MtnQueueProcessor,
  ],
})
export class MtnModule {}
