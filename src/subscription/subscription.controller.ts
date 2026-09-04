import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CgwSubscriber } from '../entities/cgw-subscriber.entity';
import { CgwJwtGuard } from './cgw-jwt.guard';
import { SubscriptionAccessService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionAccessService) {}

  @Post('dev-activate')
  async devActivate(
    @Body() body: { msisdn?: string; phone?: string; mobileNumber?: string; offerCode?: string },
  ) {
    if (process.env.ENABLE_LOCAL_SUBSCRIPTION !== 'true') {
      throw new NotFoundException({
        success: false,
        message: 'Local subscription bypass is disabled',
      });
    }

    const secret = process.env.JWT_SECRET || '';
    if (!secret) {
      throw new UnauthorizedException({
        success: false,
        message: 'JWT_SECRET is not configured',
      });
    }

    const msisdn = body?.msisdn || body?.phone || body?.mobileNumber;
    const user = await this.subscriptionService.activateByMsisdn(msisdn);
    const offerCode =
      body.offerCode || process.env.CGW_INITIAL_OFFER_CODE || process.env.CGW_OFFER_CODE;

    return {
      success: true,
      token: this.subscriptionService.createToken(user.id, secret),
      offerCode,
      msisdn: user.phone,
      subscription: this.subscriptionService.getSummary(user),
    };
  }

  @Get('status')
  @UseGuards(CgwJwtGuard)
  status(@Req() req: Request & { user?: CgwSubscriber }) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: 'Not authorized',
      });
    }

    return {
      success: true,
      subscription: this.subscriptionService.getSummary(user),
    };
  }
}
