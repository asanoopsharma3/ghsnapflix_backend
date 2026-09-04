import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CallbackModule } from './callback.module';
import { CgwModule } from './cgw/cgw.module';
import { CallbackTransaction } from './entities/callback-transaction.entity';
import { CgwCallback } from './entities/cgw-callback.entity';
import { CgwCallbackLog } from './entities/cgw-callback-log.entity';
import { CgwSubscriber } from './entities/cgw-subscriber.entity';
import { GhanaCallbackLog } from './entities/ghana-callback-log.entity';
import { MsisdnLog } from './entities/msisdn-log.entity';
import { MtnCallbackAutoState } from './entities/mtn-callback-auto-state.entity';
import { MtnSubscriptionBatch } from './entities/mtn-subscription-batch.entity';
import { MtnSubscriptionQueue } from './entities/mtn-subscription-queue.entity';
import { MtnTokenCache } from './entities/mtn-token-cache.entity';
import { SdpCallback } from './entities/sdp-callback.entity';
import { SdpLog } from './entities/sdp-log.entity';
import { SubscriptionMisdn } from './entities/subscription-misdn.entity';
import { LoggingModule } from './logging/logging.module';
import { MtnModule } from './mtn/mtn.module';
import { SubscriptionModule } from './subscription/subscription.module';

function envBool(
  config: ConfigService,
  key: string,
  defaultValue = false,
): boolean {
  const v = config.get<string>(key);
  if (v === undefined || v === '') return defaultValue;
  return v === 'true' || v === '1' || v === 'yes';
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const ssl = envBool(config, 'DB_SSL');
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE'),
          entities: [
            CallbackTransaction,
            CgwCallback,
            CgwCallbackLog,
            CgwSubscriber,
            GhanaCallbackLog,
            MsisdnLog,
            MtnCallbackAutoState,
            MtnSubscriptionBatch,
            MtnSubscriptionQueue,
            MtnTokenCache,
            SdpCallback,
            SdpLog,
            SubscriptionMisdn,
          ],
          synchronize: false,
          logging: envBool(config, 'DB_LOGGING'),
          ssl: ssl
            ? {
                rejectUnauthorized: envBool(
                  config,
                  'DB_SSL_REJECT_UNAUTHORIZED',
                  true,
                ),
              }
            : false,
        };
      },
      inject: [ConfigService],
    }),
    CallbackModule,
    CgwModule,
    MtnModule,
    SubscriptionModule,
    LoggingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
