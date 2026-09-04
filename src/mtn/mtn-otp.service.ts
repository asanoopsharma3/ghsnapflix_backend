import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';
import {
  MTN_OTP_DEV_CODE,
  MTN_OTP_EXPIRY_MINUTES,
  MTN_OTP_LENGTH,
  MTN_OTP_MESSAGE_TEMPLATE,
  MTN_OTP_VERIFIED_EXPIRY_MINUTES,
} from './mtn.constants';
import { MtnSmsSendResult, MtnSmsService } from './mtn-sms.service';

type StoredOtp = {
  otp: string;
  expiresAt: Date;
  clientCorrelator: string;
};

export type MtnSendOtpResult = {
  ok: boolean;
  statusCode: string | null;
  statusMessage: string | null;
  transactionId: string | null;
  deliveryStatus: string | null;
  clientCorrelator: string;
  errorMessage: string | null;
  devMode?: boolean;
  devOtp?: string;
};

export type MtnVerifyOtpResult = {
  ok: boolean;
  verified: boolean;
  errorMessage: string | null;
};

type VerifiedMsisdn = {
  expiresAt: Date;
};

@Injectable()
export class MtnOtpService {
  private readonly logger = new Logger(MtnOtpService.name);
  private readonly otpStore = new Map<string, StoredOtp>();
  private readonly verifiedStore = new Map<string, VerifiedMsisdn>();

  constructor(
    private readonly config: ConfigService,
    private readonly smsService: MtnSmsService,
  ) {}

  private isDevBypassEnabled(): boolean {
    const v = this.config.get<string>('MTN_OTP_DEV_BYPASS', 'false');
    return v === 'true' || v === '1' || v === 'yes';
  }

  private getDevOtp(): string {
    return this.config.get<string>('MTN_OTP_DEV_CODE', MTN_OTP_DEV_CODE);
  }

  normalizeMsisdn(msisdn: string): string {
    const normalized = msisdn.replace(/\D/g, '');
    if (!normalized) {
      throw new BadRequestException('msisdn is required');
    }
    if (normalized.length < 10 || normalized.length > 15) {
      throw new BadRequestException('msisdn must be a valid phone number');
    }
    return normalized;
  }

  generateOtp(): string {
    const min = 10 ** (MTN_OTP_LENGTH - 1);
    const max = 10 ** MTN_OTP_LENGTH;
    return String(randomInt(min, max));
  }

  buildOtpMessage(otp: string): string {
    return MTN_OTP_MESSAGE_TEMPLATE.replace('{otp}', otp);
  }

  private storeOtp(
    normalizedMsisdn: string,
    otp: string,
    clientCorrelator: string,
  ): void {
    const expiresAt = new Date(
      Date.now() + Math.max(MTN_OTP_EXPIRY_MINUTES, 1) * 60 * 1000,
    );
    this.otpStore.set(normalizedMsisdn, {
      otp,
      expiresAt,
      clientCorrelator,
    });
  }

  async sendOtp(msisdn: string): Promise<MtnSendOtpResult> {
    const normalizedMsisdn = this.normalizeMsisdn(msisdn);
    const clientCorrelator = randomUUID();

    if (this.isDevBypassEnabled()) {
      const devOtp = this.getDevOtp();
      this.storeOtp(normalizedMsisdn, devOtp, clientCorrelator);
      this.logger.warn(
        `DEV BYPASS: OTP for msisdn=${normalizedMsisdn} is ${devOtp} (SMS not sent)`,
      );
      return {
        ok: true,
        statusCode: '0000',
        statusMessage: 'Dev bypass: OTP generated without SMS',
        transactionId: `dev-${clientCorrelator.slice(0, 8)}`,
        deliveryStatus: 'DEV_BYPASS',
        clientCorrelator,
        errorMessage: null,
        devMode: true,
        devOtp,
      };
    }

    const otp = this.generateOtp();
    const message = this.buildOtpMessage(otp);

    const result: MtnSmsSendResult = await this.smsService.sendOutboundSms(
      normalizedMsisdn,
      message,
      clientCorrelator,
    );

    if (result.ok) {
      this.storeOtp(normalizedMsisdn, otp, clientCorrelator);
      this.logger.log(
        `OTP sent to msisdn=${normalizedMsisdn} clientCorrelator=${clientCorrelator}`,
      );
    }

    return this.toSendOtpResult(result);
  }

  async verifyOtp(msisdn: string, otp: string): Promise<MtnVerifyOtpResult> {
    const normalizedMsisdn = this.normalizeMsisdn(msisdn);
    const normalizedOtp = otp.replace(/\D/g, '');

    if (!normalizedOtp) {
      return {
        ok: false,
        verified: false,
        errorMessage: 'otp is required',
      };
    }

    const stored = this.otpStore.get(normalizedMsisdn);
    if (!stored) {
      return {
        ok: false,
        verified: false,
        errorMessage: 'No OTP found for this msisdn. Please request a new OTP.',
      };
    }

    if (stored.expiresAt <= new Date()) {
      this.otpStore.delete(normalizedMsisdn);
      return {
        ok: false,
        verified: false,
        errorMessage: 'OTP has expired. Please request a new OTP.',
      };
    }

    if (stored.otp !== normalizedOtp) {
      return {
        ok: false,
        verified: false,
        errorMessage: 'Invalid OTP.',
      };
    }

    this.otpStore.delete(normalizedMsisdn);

    const expiresAt = new Date(
      Date.now() + Math.max(MTN_OTP_VERIFIED_EXPIRY_MINUTES, 1) * 60 * 1000,
    );
    this.verifiedStore.set(normalizedMsisdn, { expiresAt });

    this.logger.log(`OTP verified for msisdn=${normalizedMsisdn}`);

    return {
      ok: true,
      verified: true,
      errorMessage: null,
    };
  }

  isMsisdnVerified(msisdn: string): boolean {
    const normalizedMsisdn = this.normalizeMsisdn(msisdn);
    const stored = this.verifiedStore.get(normalizedMsisdn);
    if (!stored) return false;

    if (stored.expiresAt <= new Date()) {
      this.verifiedStore.delete(normalizedMsisdn);
      return false;
    }

    return true;
  }

  consumeVerifiedMsisdn(msisdn: string): boolean {
    const normalizedMsisdn = this.normalizeMsisdn(msisdn);
    if (!this.isMsisdnVerified(normalizedMsisdn)) return false;
    this.verifiedStore.delete(normalizedMsisdn);
    return true;
  }

  private toSendOtpResult(result: MtnSmsSendResult): MtnSendOtpResult {
    return {
      ok: result.ok,
      statusCode: result.statusCode,
      statusMessage: result.statusMessage,
      transactionId: result.transactionId,
      deliveryStatus: result.deliveryStatus,
      clientCorrelator: result.clientCorrelator,
      errorMessage: result.errorMessage,
    };
  }
}
