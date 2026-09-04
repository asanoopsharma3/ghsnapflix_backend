import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionMisdn } from '../entities/subscription-misdn.entity';
import { MtnAuthService } from './mtn-auth.service';
import { MTN_SUBSCRIPTION_PAYLOAD } from './mtn.constants';
import {
  getMtnSubscriptionName,
  normalizeMtnPlanId,
} from './mtn-plan.util';

export type MtnSubscriptionApiResponse = Record<string, unknown>;

export type MtnSubscriptionResult = {
  ok: boolean;
  statusCode: string | null;
  statusMessage: string | null;
  amountCharged: string;
  response: MtnSubscriptionApiResponse | null;
  errorMessage: string | null;
  transactionId: string;
};

function formatMoney(v: unknown): string {
  const n = Number(v);
  if (Number.isNaN(n)) return '0.00';
  return n.toFixed(2);
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function bool(v: unknown): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function optionalMoney(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return formatMoney(v);
}

function extractStatusMessage(r: MtnSubscriptionApiResponse): string | null {
  const statusMessage = str(r.statusMessage);
  if (statusMessage) return statusMessage;

  const status = str(r.status);
  const statusCode = str(r.statusCode);
  if (status && statusCode && status !== statusCode) return status;

  return null;
}

function extractStatusText(r: MtnSubscriptionApiResponse): string | null {
  const status = r.status;
  if (status === undefined || status === null) return null;
  return String(status);
}

@Injectable()
export class MtnSubscriptionService {
  private readonly logger = new Logger(MtnSubscriptionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly authService: MtnAuthService,
    @InjectRepository(SubscriptionMisdn)
    private readonly subscriptionMisdnRepo: Repository<SubscriptionMisdn>,
  ) {}

  async subscribe(
    msisdn: string,
    transactionId: string,
    planId: string,
  ): Promise<MtnSubscriptionResult> {
    const baseUrl = this.config.get<string>(
      'MTN_API_BASE_URL',
      'https://api.mtn.com',
    );
    const apiKey = this.config.get<string>('MTN_API_KEY');

    if (!apiKey) {
      throw new Error('MTN_API_KEY must be set in .env');
    }

    const normalizedPlanId = normalizeMtnPlanId(planId);
    if (!normalizedPlanId) {
      throw new Error(`Invalid plan_id ${planId}`);
    }

    const subscriptionName = getMtnSubscriptionName(normalizedPlanId);
    if (!subscriptionName) {
      throw new Error(
        `Unknown plan_id ${planId}: no subscriptionName mapping`,
      );
    }

    const token = await this.authService.getAccessToken();
    const url = `${baseUrl}/v2/customers/${msisdn}/subscriptions`;
    const payload = {
      ...MTN_SUBSCRIPTION_PAYLOAD,
      subscriptionId: normalizedPlanId,
      subscriptionName,
    };

    this.logger.debug(
      `MTN subscribe msisdn=${msisdn} subscriptionId=${normalizedPlanId} subscriptionName=${subscriptionName} transactionId=${transactionId}`,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          transactionid: transactionId,
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: MtnSubscriptionApiResponse | null = null;

      try {
        data = text ? (JSON.parse(text) as MtnSubscriptionApiResponse) : null;
      } catch {
        data = { raw: text };
      }

      const parsed = data ?? {};
      const statusCode =
        str(parsed.statusCode) ??
        (response.ok ? str(parsed.status) : String(response.status));
      const statusMessage =
        extractStatusMessage(parsed) ??
        (!response.ok
          ? `HTTP ${response.status}: ${text.slice(0, 500)}`
          : null);
      const amountCharged = formatMoney(parsed.amountCharged ?? 0);
      const isSuccess = statusCode === '0000';

      if (!response.ok) {
        return {
          ok: false,
          statusCode,
          statusMessage,
          amountCharged,
          response: data,
          errorMessage: statusMessage ?? 'Subscription failed',
          transactionId,
        };
      }

      return {
        ok: isSuccess,
        statusCode,
        statusMessage,
        amountCharged,
        response: data,
        errorMessage: isSuccess
          ? null
          : (statusMessage ?? 'Subscription failed'),
        transactionId,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`MTN subscribe error msisdn=${msisdn}: ${message}`);
      return {
        ok: false,
        statusCode: null,
        statusMessage: null,
        amountCharged: '0.00',
        response: null,
        errorMessage: message,
        transactionId,
      };
    }
  }

  async subscribeAndSave(
    msisdn: string,
    transactionId: string,
    planId: string,
  ): Promise<{ result: MtnSubscriptionResult; subscriptionMisdnId: string }> {
    const result = await this.subscribe(msisdn, transactionId, planId);
    const subscriptionMisdnId = await this.saveToSubscriptionMisdn(
      msisdn,
      planId,
      result,
    );
    return { result, subscriptionMisdnId };
  }

  async saveToSubscriptionMisdn(
    msisdn: string,
    planId: string,
    result: MtnSubscriptionResult,
  ): Promise<string> {
    const r = result.response ?? {};

    const normalizedPlanId = normalizeMtnPlanId(planId) ?? planId;

    const entity = new SubscriptionMisdn();
    entity.msisdn = msisdn;
    entity.planId = normalizedPlanId;
    entity.logTime = new Date();
    entity.customerId = msisdn;

    entity.statusCode = str(r.statusCode) ?? result.statusCode;
    entity.statusMessage = extractStatusMessage(r) ?? result.statusMessage;
    entity.status = extractStatusText(r);
    entity.httpStatus = str(r.httpStatus);

    entity.subscriptionName =
      getMtnSubscriptionName(normalizedPlanId) ?? str(r.subscriptionName);
    entity.registrationChannel =
      str(r.registrationChannel) ??
      MTN_SUBSCRIPTION_PAYLOAD.registrationChannel;
    entity.amountCharged = optionalMoney(r.amountCharged) ?? result.amountCharged;
    entity.sendSmsNotification = bool(r.sendSMSNotification);
    entity.autoRenew = bool(r.autoRenew);
    entity.amountBefore = optionalMoney(r.amountBefore);
    entity.amountAfter = optionalMoney(r.amountAfter);
    entity.nonGsm = bool(r.nonGSM);
    entity.cvmoffer = bool(r.cvmoffer);
    entity.serviceNode = str(r.nodeId);

    entity.responsePayload = result.response;

    const saved = await this.subscriptionMisdnRepo.save(entity);
    return saved.id;
  }
}
