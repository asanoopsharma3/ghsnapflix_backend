import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CgwCallback } from '../entities/cgw-callback.entity';
import { CgwCallbackLog } from '../entities/cgw-callback-log.entity';
import { CgwSubscriber } from '../entities/cgw-subscriber.entity';
import { GhanaCallbackLog } from '../entities/ghana-callback-log.entity';
import { MsisdnLog } from '../entities/msisdn-log.entity';
import { SdpCallback } from '../entities/sdp-callback.entity';
import { SdpLog } from '../entities/sdp-log.entity';
import { CgwActivateGuard } from './cgw-activate.guard';
import { CgwController } from './cgw.controller';
import { CgwLegacyCallbackController } from './cgw-legacy-callback.controller';
import { CgwService } from './cgw.service';
import { HeaderEnrichmentMiddleware } from './header-enrichment.middleware';

const cgwEntities = [
  MsisdnLog,
  CgwCallback,
  CgwCallbackLog,
  GhanaCallbackLog,
  SdpCallback,
  SdpLog,
  CgwSubscriber,
];

@Module({
  imports: [TypeOrmModule.forFeature(cgwEntities)],
  controllers: [CgwController, CgwLegacyCallbackController],
  providers: [CgwService, CgwActivateGuard],
})
export class CgwModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(HeaderEnrichmentMiddleware)
      .forRoutes(CgwController, CgwLegacyCallbackController);
  }
}
