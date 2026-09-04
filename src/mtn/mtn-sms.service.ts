import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MtnAuthService } from './mtn-auth.service';

export type MtnSmsApiResponse = {
  statusCode?: string;
  statusMessage?: string;
  transactionId?: string;
  data?: {
    status?: string;
  };
  [key: string]: unknown;
};

export type MtnSmsSendResult = {
  ok: boolean;
  statusCode: string | null;
  statusMessage: string | null;
  transactionId: string | null;
  deliveryStatus: string | null;
  clientCorrelator: string;
  response: MtnSmsApiResponse | null;
  errorMessage: string | null;
};

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

@Injectable()
export class MtnSmsService {
  private readonly logger = new Logger(MtnSmsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly authService: MtnAuthService,
  ) {}

  async sendOutboundSms(
    receiverAddress: string,
    message: string,
    clientCorrelator: string,
  ): Promise<MtnSmsSendResult> {
    const baseUrl = this.config.get<string>(
      'MTN_API_BASE_URL',
      'https://api.mtn.com',
    );
    const apiKey = this.config.get<string>('MTN_API_KEY');
    const senderAddress = this.config.get<string>('MTN_SMS_SENDER_ADDRESS');

    if (!apiKey) {
      throw new Error('MTN_API_KEY must be set in .env');
    }

    if (!senderAddress) {
      throw new Error('MTN_SMS_SENDER_ADDRESS must be set in .env');
    }

    const token = await this.authService.getAccessToken();
    const url = `${baseUrl}/v2/messages/sms/outbound`;
    const payload = {
      senderAddress,
      receiverAddress: [receiverAddress],
      message,
      clientCorrelator,
    };

    this.logger.debug(
      `MTN SMS outbound msisdn=${receiverAddress} clientCorrelator=${clientCorrelator}`,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: MtnSmsApiResponse | null = null;

      try {
        data = text ? (JSON.parse(text) as MtnSmsApiResponse) : null;
      } catch {
        data = { raw: text };
      }

      const parsed = data ?? {};
      const statusCode =
        str(parsed.statusCode) ??
        (response.ok ? null : String(response.status));
      const statusMessage =
        str(parsed.statusMessage) ??
        (!response.ok
          ? `HTTP ${response.status}: ${text.slice(0, 500)}`
          : null);
      const transactionId = str(parsed.transactionId);
      const deliveryStatus = str(parsed.data?.status);
      const isSuccess = statusCode === '0000';

      if (!response.ok) {
        return {
          ok: false,
          statusCode,
          statusMessage,
          transactionId,
          deliveryStatus,
          clientCorrelator,
          response: data,
          errorMessage: statusMessage ?? 'SMS send failed',
        };
      }

      return {
        ok: isSuccess,
        statusCode,
        statusMessage,
        transactionId,
        deliveryStatus,
        clientCorrelator,
        response: data,
        errorMessage: isSuccess ? null : (statusMessage ?? 'SMS send failed'),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `MTN SMS outbound error msisdn=${receiverAddress}: ${message}`,
      );
      return {
        ok: false,
        statusCode: null,
        statusMessage: null,
        transactionId: null,
        deliveryStatus: null,
        clientCorrelator,
        response: null,
        errorMessage: message,
      };
    }
  }
}
