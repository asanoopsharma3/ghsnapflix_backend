import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DeepPartial, Repository } from 'typeorm';
import { CgwCallback } from '../entities/cgw-callback.entity';
import { CgwCallbackLog } from '../entities/cgw-callback-log.entity';
import { CgwSubscriber } from '../entities/cgw-subscriber.entity';
import { GhanaCallbackLog } from '../entities/ghana-callback-log.entity';
import { MsisdnLog } from '../entities/msisdn-log.entity';
import { SdpCallback } from '../entities/sdp-callback.entity';
import { SdpLog } from '../entities/sdp-log.entity';
import {
  getClientMeta,
  getHeaderMsisdn,
  headerRecord,
  toJsonObject,
} from './cgw-request.util';
import { createCgwToken } from './cgw-token.util';
import {
  buildCgwSettings,
  generateCGWUrl,
  generateFixedHEUrl,
  mapCGWStatus,
  normalizeMsisdn,
  parseCGWCallback,
  type CgwSettings,
} from './cgw.config';
import { SUBSCRIPTION_CYCLE_MS } from './cgw.constants';

type SdpItem = { name?: unknown; value?: unknown };

export type CgwActionResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'ok'; body: string }
  | { kind: 'json'; status: number; body: Record<string, unknown> };

@Injectable()
export class CgwService {
  private readonly logger = new Logger(CgwService.name);
  private readonly settings: CgwSettings;

  constructor(
    @InjectRepository(MsisdnLog)
    private readonly msisdnLogRepo: Repository<MsisdnLog>,
    @InjectRepository(CgwCallbackLog)
    private readonly cgwCallbackLogRepo: Repository<CgwCallbackLog>,
    @InjectRepository(CgwCallback)
    private readonly cgwCallbackRepo: Repository<CgwCallback>,
    @InjectRepository(GhanaCallbackLog)
    private readonly ghanaCallbackLogRepo: Repository<GhanaCallbackLog>,
    @InjectRepository(SdpCallback)
    private readonly sdpCallbackRepo: Repository<SdpCallback>,
    @InjectRepository(SdpLog)
    private readonly sdpLogRepo: Repository<SdpLog>,
    @InjectRepository(CgwSubscriber)
    private readonly subscriberRepo: Repository<CgwSubscriber>,
  ) {
    this.settings = buildCgwSettings(process.env);
  }

  startHeaderEnrichmentRedirect(req: Request): Promise<CgwActionResult> {
    return this.runSafe('Error starting HE redirect', async () => {
      const offerCode = this.firstString(
        req.query.offerCode,
        this.body(req).offerCode,
        this.settings.offerCode,
      );
      const redirectUrl = this.firstString(
        req.query.redirectUrl,
        this.body(req).redirectUrl,
        this.settings.heRedirectUrl,
      );
      const mobileNumber = this.firstString(
        req.query.mobileNumber,
        this.body(req).mobileNumber,
        this.settings.heFixedMobileNumber,
      );

      await this.logMsisdn(req, mobileNumber, 'HE_REDIRECT', offerCode);

      return {
        kind: 'redirect',
        url: generateFixedHEUrl(this.settings, {
          offerCode,
          redirectUrl,
          mobileNumber,
        }),
      };
    });
  }

  generateCGWRedirectUrl(
    req: Request,
    forceNonHe = false,
  ): Promise<CgwActionResult> {
    return this.runSafe('Error generating Consent Gateway URL', async () => {
      const msisdnFromHeader = getHeaderMsisdn(
        req.headers,
        (req as Request & { msisdn?: string }).msisdn,
      );
      const body = this.body(req);
      const msisdnFromBody = this.firstString(
        body.msisdn,
        req.query.msisdn,
        body.mobileNumber,
        req.query.mobileNumber,
      );
      const msisdn = normalizeMsisdn(msisdnFromHeader || msisdnFromBody);
      const isHeaderEnrichment = forceNonHe
        ? false
        : Boolean(msisdnFromHeader);
      const offerCode = this.firstString(
        req.query.offerCode,
        body.offerCode,
        this.settings.offerCode,
      );
      const redirectUrl = this.firstString(
        req.query.redirectUrl,
        body.redirectUrl,
        this.settings.callbackUrl,
      );

      if (!msisdnFromHeader && !msisdnFromBody) {
        return {
          kind: 'redirect',
          url: `${this.settings.frontendBaseUrl}/subscribe?fallback=true&offerCode=${offerCode}`,
        };
      }

      if (!msisdn || !msisdn.startsWith('233') || msisdn.length < 12) {
        return {
          kind: 'json',
          status: 400,
          body: {
            success: false,
            message: 'Invalid MSISDN format. Expected format: 233XXXXXXXXX',
          },
        };
      }

      await this.logMsisdn(
        req,
        msisdn,
        isHeaderEnrichment ? 'HE' : 'NHE',
        offerCode,
      );

      return {
        kind: 'redirect',
        url: generateCGWUrl(
          this.settings,
          msisdn,
          isHeaderEnrichment,
          offerCode,
          redirectUrl,
        ),
      };
    });
  }

  handleCGWCallback(req: Request): Promise<CgwActionResult> {
    return this.runSafe(
      'Callback processing error',
      async () => {
        const sdpData = this.body(req).requestParam as
          | { data?: unknown; planId?: unknown; command?: unknown }
          | undefined;
        const items = Array.isArray(sdpData?.data) ? sdpData.data : null;

        if (items && items.length > 0) {
          await this.handleSdpCallback(req, items as SdpItem[], sdpData);
          return { kind: 'ok', body: 'OK' };
        }

        return this.handleConsentCallback(req);
      },
      true,
    );
  }

  private async handleSdpCallback(
    req: Request,
    sdpData: SdpItem[],
    requestParam?: { planId?: unknown; command?: unknown },
  ): Promise<void> {
    const body = this.body(req);
    const msisdn = normalizeMsisdn(this.getSdpValue(sdpData, ['Msisdn', 'MSISDN']));
    const status = this.getSdpValue(sdpData, ['SubscriptionStatus']);
    const offerCode = this.getSdpValue(sdpData, ['OfferCode']);
    const lifecycle = this.getSdpValue(sdpData, [
      'SubscriberLifeCycle',
      'SubscriberLifecycle',
    ]);
    const reason = this.getSdpValue(sdpData, [
      'Reason',
      'ResultMessage',
      'Message',
    ]);
    const chargeAmount = Number(
      this.getSdpValue(sdpData, [
        'ChargeAmount',
        'ChargingAmount',
        'Amount',
      ]) || 0,
    );
    const nextBillingDate = this.getSdpValue(sdpData, ['NextBillingDate']);
    const transactionId =
      this.getSdpValue(sdpData, [
        'TransactionId',
        'TransactionID',
        'SequenceNo',
        'RequestNo',
      ]) ||
      this.getPayloadValue(body, [
        'transactionId',
        'transactionID',
        'sequenceNo',
        'requestNo',
      ]);
    const operator =
      this.getSdpValue(sdpData, ['Operator', 'Network']) ||
      this.getPayloadValue(body, ['operator', 'network']) ||
      'MTN Ghana';
    const normalizedStatus = this.normalizeSdpStatus(status, lifecycle, reason);
    const meta = getClientMeta(req);

    this.logger.log('SDP CALLBACK DATA:');
    this.logger.log(JSON.stringify(body, null, 2));

    const sdpPayload = {
      method: req.method,
      msisdn,
      transactionId: transactionId || null,
      offerCode: offerCode || null,
      status: status || null,
      operator,
      operatorResponse: body,
      callbackTimestamp: new Date(),
      payloadJson: { query: toJsonObject(req.query), body },
      lifecycle: lifecycle || null,
      reason: reason || null,
      rawQuery: toJsonObject(req.query),
      rawBody: body,
      headers: headerRecord(req.headers),
      ip: meta.ip,
      userAgent: meta.userAgent,
    };

    const savedSdpCallback = await this.saveQuietly(
      this.cgwCallbackLogRepo,
      {
        type: 'SDP',
        method: req.method,
        msisdn,
        offerCode: offerCode || null,
        status: status || null,
        lifecycle: lifecycle || null,
        reason: reason || null,
        rawQuery: toJsonObject(req.query),
        rawBody: body,
        headers: headerRecord(req.headers),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      'SDP callback DB save error',
    );

    await this.saveQuietly(
      this.sdpCallbackRepo,
      sdpPayload,
      'SDP dedicated callback DB save error',
    );

    const savedSdpLog = await this.saveQuietly(
      this.sdpLogRepo,
      {
        method: req.method,
        externalServiceId: this.asString(body.externalServiceId),
        requestId: this.asString(body.requestId),
        requestTimeStamp: this.asString(body.requestTimeStamp),
        channel: this.asString(body.channel),
        featureId: this.asString(body.featureId),
        planId: this.asString(requestParam?.planId),
        command: this.asString(requestParam?.command),
        msisdn,
        offerCode: offerCode || null,
        chargeAmount: chargeAmount.toFixed(2),
        subscriptionStatus: status || null,
        subscriberLifeCycle: lifecycle || null,
        transactionId: transactionId || null,
        nextBillingDate: nextBillingDate || null,
        reason: reason || null,
        normalizedStatus,
        operator,
        callbackTimestamp: new Date(),
        payloadJson: { query: toJsonObject(req.query), body },
        rawQuery: toJsonObject(req.query),
        rawBody: body,
        headers: headerRecord(req.headers),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      'SDP sdplog DB save error',
    );

    await this.saveQuietly(
      this.ghanaCallbackLogRepo,
      {
        callbackType: 'SDP',
        flow: this.detectFlow(req),
        method: req.method,
        msisdn,
        offerCode: offerCode || null,
        status: status || null,
        normalizedStatus,
        lifecycle: lifecycle || null,
        reason: reason || null,
        chargingAmount: chargeAmount.toFixed(2),
        rawQuery: toJsonObject(req.query),
        rawBody: body,
        headers: headerRecord(req.headers),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      'Ghana SDP callback log DB save error',
    );

    if (savedSdpCallback) {
      this.logger.log(`SDP callback saved in DB: ${savedSdpCallback.id}`);
    }
    if (savedSdpLog) {
      this.logger.log(`SDP callback saved in sdplog: ${savedSdpLog.id}`);
    }

    if (msisdn) {
      await this.applySubscriptionStatus(msisdn, status, lifecycle);
    }
  }

  private async handleConsentCallback(req: Request): Promise<CgwActionResult> {
    const body = this.body(req);
    const callbackData = parseCGWCallback({
      ...toJsonObject(body.data),
      ...toJsonObject(body.response),
      ...body,
      ...toJsonObject(req.query),
    });
    callbackData.msisdn = normalizeMsisdn(callbackData.msisdn) ?? undefined;
    const offerCode =
      callbackData.offerId ||
      this.firstString(req.query.offerCode, this.settings.initialOfferCode);
    const meta = getClientMeta(req);

    this.logger.log('========== CGW CALLBACK RECEIVED ==========');
    this.logger.log(`Method: ${req.method}`);
    this.logger.log(`MSISDN: ${callbackData.msisdn || '-'}`);
    this.logger.log(`OfferCode: ${offerCode || '-'}`);
    this.logger.log(`Status: ${callbackData.status || '-'}`);
    this.logger.log(`CGID: ${callbackData.cgid || '-'}`);
    this.logger.log(`Query: ${JSON.stringify(req.query)}`);
    this.logger.log(`Body: ${JSON.stringify(body)}`);

    const statusMapping =
      callbackData.status !== undefined && callbackData.status !== null
        ? mapCGWStatus(callbackData.status, { offerCode })
        : null;

    const cgwPayload = {
      method: req.method,
      msisdn: callbackData.msisdn || null,
      offerCode,
      status: callbackData.status || null,
      cgid: callbackData.cgid || null,
      rawQuery: toJsonObject(req.query),
      rawBody: body,
      headers: headerRecord(req.headers),
      ip: meta.ip,
      userAgent: meta.userAgent,
    };

    const savedCgwCallback = await this.saveQuietly(
      this.cgwCallbackLogRepo,
      { type: 'CGW', ...cgwPayload },
      'CGW callback DB save error',
    );

    await this.saveQuietly(
      this.cgwCallbackRepo,
      cgwPayload,
      'CGW dedicated callback DB save error',
    );

    await this.saveQuietly(
      this.ghanaCallbackLogRepo,
      {
        callbackType: 'CGW',
        flow: this.detectFlow(req),
        method: req.method,
        msisdn: callbackData.msisdn || null,
        offerCode,
        status: callbackData.status || null,
        normalizedStatus: statusMapping?.success ? 'success' : 'failed',
        reason: statusMapping?.message || null,
        cgid: callbackData.cgid || null,
        chargingAmount: '0.00',
        rawQuery: toJsonObject(req.query),
        rawBody: body,
        headers: headerRecord(req.headers),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      'Ghana CGW callback log DB save error',
    );

    if (savedCgwCallback) {
      this.logger.log(`CGW callback saved in DB: ${savedCgwCallback.id}`);
    }

    if (statusMapping?.success) {
      const user = await this.applySubscriptionStatus(
        callbackData.msisdn || '',
        callbackData.status || '',
        '',
        offerCode,
      );
      const params = new URLSearchParams({
        status: 'success',
        subscribed: 'true',
        msisdn: callbackData.msisdn || '',
        offerCode,
      });
      if (user && this.settings.jwtSecret) {
        params.set('token', createCgwToken(user.id, this.settings.jwtSecret));
      }

      return {
        kind: 'redirect',
        url: `${this.settings.frontendBaseUrl}/activation/callback?${params.toString()}`,
      };
    }

    const params = new URLSearchParams({
      subscribed: 'false',
      reason: statusMapping?.message || 'Unknown status',
      offerCode,
    });

    return {
      kind: 'redirect',
      url: `${this.settings.frontendBaseUrl}/activation/callback?${params.toString()}`,
    };
  }

  private async applySubscriptionStatus(
    msisdn: string,
    status: string,
    lifecycle = '',
    offerCode = '',
  ): Promise<CgwSubscriber | null> {
    if (!msisdn) return null;

    const normalized = String(status || '').toUpperCase();
    const normalizedLifecycle = String(lifecycle || '').toUpperCase();
    const statusMapping = mapCGWStatus(status, { offerCode });
    const isBillingSuccess =
      statusMapping.success || this.isSdpSuccessStatus(status, lifecycle);
    const isTopupBillingSuccess =
      isBillingSuccess &&
      Boolean(offerCode) &&
      String(offerCode) !== String(this.settings.initialOfferCode);

    const phone = `+${msisdn}`;
    let user = await this.subscriberRepo.findOne({
      where: [{ phone }, { phone: msisdn }],
    });
    if (!user) {
      user = this.subscriberRepo.create({ phone });
    }

    if (isBillingSuccess) {
      user.subscriptionStatus = 'active';
      user.isAttemptQuiz = false;
      if (isTopupBillingSuccess) {
        user.questionsPlayedToday = 0;
      } else if (!user.subscriptionStartTime) {
        user.subscriptionStartTime = new Date();
        user.nextPlayTime = new Date(Date.now() + SUBSCRIPTION_CYCLE_MS);
      }
      return this.subscriberRepo.save(user);
    }

    const isSuspended = ['S', 'SUSPENDED', '112'].includes(normalized);
    const isUnsubscribed =
      normalizedLifecycle.includes('UNSUB') ||
      [
        'D',
        'DEACTIVE',
        'DEACTIVATED',
        'INACTIVE',
        'UNSUB',
        'UNSUBSCRIBED',
      ].includes(normalized);

    user.subscriptionStatus =
      isSuspended && !isUnsubscribed ? 'suspended' : 'inactive';
    user.isAttemptQuiz = true;
    user.questionsPlayedToday = 0;
    return this.subscriberRepo.save(user);
  }

  private isSdpSuccessStatus(status: string, lifecycle = ''): boolean {
    const statusText = String(status || '').toLowerCase();
    const lifecycleText = String(lifecycle || '').toLowerCase();
    if (lifecycleText.includes('unsub')) return false;
    return ['success', 'successful', 'active', 'a', '200', '9', '115'].includes(
      statusText,
    );
  }

  private detectFlow(req: Request): 'HE' | 'NHE' | 'UNKNOWN' {
    const body = this.body(req);
    const source = String(
      req.query.flow || body.flow || req.query.source || body.source || '',
    ).toUpperCase();
    if (source === 'HE' || source === 'NHE') return source;
    if (req.query.mobileNumber || body.mobileNumber) return 'NHE';
    return 'UNKNOWN';
  }

  private getSdpValue(items: SdpItem[], names: string[]): string {
    const lookupNames = names.map((name) => String(name).toLowerCase());
    const found = items.find((item) =>
      lookupNames.includes(String(item.name || '').toLowerCase()),
    );
    return found?.value != null ? String(found.value) : '';
  }

  private getPayloadValue(
    payload: Record<string, unknown>,
    keys: string[],
  ): string {
    for (const key of keys) {
      if (payload?.[key] !== undefined && payload?.[key] !== null) {
        return String(payload[key]);
      }
    }
    return '';
  }

  private normalizeSdpStatus(
    status = '',
    lifecycle = '',
    reason = '',
  ): string {
    const statusText = String(status).toUpperCase();
    const lifecycleText = String(lifecycle).toUpperCase();
    const reasonText = String(reason).toLowerCase();

    if (lifecycleText.includes('REN') || reasonText.includes('renew')) {
      return 'renewal';
    }
    if (
      reasonText.includes('insufficient') ||
      reasonText.includes('low balance') ||
      ['2', '26', '29', '55', '63', '111', 'G'].includes(statusText)
    ) {
      return 'churn';
    }
    if (
      ['D', 'S', 'INACTIVE', 'SUSPENDED', 'UNSUB', 'UNSUBSCRIBED'].includes(
        statusText,
      )
    ) {
      return 'failed';
    }
    return statusText ? 'failed' : 'unknown';
  }

  private async logMsisdn(
    req: Request,
    msisdn: string,
    source: string,
    offerCode: string,
  ): Promise<void> {
    const meta = getClientMeta(req);
    await this.saveQuietly(
      this.msisdnLogRepo,
      {
        msisdn,
        source,
        offerCode,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      'MSISDN log save error',
    );
  }

  private async saveQuietly<T extends { id: string }>(
    repo: Repository<T>,
    data: DeepPartial<T>,
    label: string,
  ): Promise<T | null> {
    try {
      return await repo.save(repo.create(data) as T);
    } catch (error) {
      this.logger.error(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async runSafe(
    errorMessage: string,
    fn: () => Promise<CgwActionResult>,
    redirectOnError = false,
  ): Promise<CgwActionResult> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${errorMessage}: ${message}`);
      if (redirectOnError) {
        const params = new URLSearchParams({
          subscribed: 'false',
          reason: errorMessage,
        });
        return {
          kind: 'redirect',
          url: `${this.settings.frontendBaseUrl}/activation/callback?${params.toString()}`,
        };
      }
      return {
        kind: 'json',
        status: 500,
        body: {
          success: false,
          message: errorMessage,
          error: message,
        },
      };
    }
  }

  private body(req: Request): Record<string, unknown> {
    return toJsonObject(req.body);
  }

  private firstString(...values: unknown[]): string {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }
    return '';
  }

  private asString(value: unknown): string | null {
    if (value === undefined || value === null || String(value).trim() === '') {
      return null;
    }
    return String(value);
  }
}
