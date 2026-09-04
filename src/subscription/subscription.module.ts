import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CgwSubscriber } from '../entities/cgw-subscriber.entity';
import { CgwJwtGuard } from './cgw-jwt.guard';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionAccessService } from './subscription.service';

@Module({
  imports: [TypeOrmModule.forFeature([CgwSubscriber])],
  controllers: [SubscriptionController],
  providers: [SubscriptionAccessService, CgwJwtGuard],
})
export class SubscriptionModule {}
