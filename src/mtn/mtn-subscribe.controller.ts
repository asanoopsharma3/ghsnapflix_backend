import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { isKnownMtnPlanId } from './mtn-plan.util';
import { MtnOtpService } from './mtn-otp.service';
import { MtnSubscriptionService } from './mtn-subscription.service';
import { generateMtnRequestTransactionId } from './mtn-transaction-id.util';

type SubscribeBody = {
  msisdn?: string;
  plan_id?: string;
};

@Controller('mtn/subscribe')
export class MtnSubscribeController {
  constructor(
    private readonly otpService: MtnOtpService,
    private readonly subscriptionService: MtnSubscriptionService,
  ) {}

  /**
   * Subscribe msisdn to a plan after OTP verification.
   * Internally calls MTN POST /v2/customers/{msisdn}/subscriptions.
   */
  @Post()
  @HttpCode(200)
  async subscribe(@Body() body: SubscribeBody) {
    const msisdn = body?.msisdn?.trim();
    const planId = body?.plan_id?.trim();

    if (!msisdn) {
      return {
        ok: false,
        errorMessage: 'msisdn is required',
      };
    }

    if (!planId) {
      return {
        ok: false,
        errorMessage: 'plan_id is required',
      };
    }

    if (!isKnownMtnPlanId(planId)) {
      return {
        ok: false,
        errorMessage: `Unknown plan_id ${planId}`,
      };
    }

    if (!this.otpService.isMsisdnVerified(msisdn)) {
      return {
        ok: false,
        errorMessage: 'MSISDN not verified. Please verify OTP first.',
      };
    }

    const transactionId = generateMtnRequestTransactionId();
    const { result, subscriptionMisdnId } =
      await this.subscriptionService.subscribeAndSave(
        this.otpService.normalizeMsisdn(msisdn),
        transactionId,
        planId,
      );

    if (result.ok) {
      this.otpService.consumeVerifiedMsisdn(msisdn);
    }

    return {
      ok: result.ok,
      statusCode: result.statusCode,
      statusMessage: result.statusMessage,
      amountCharged: result.amountCharged,
      transactionId: result.transactionId,
      subscriptionMisdnId,
      data: result.response,
      errorMessage: result.errorMessage,
    };
  }
}
