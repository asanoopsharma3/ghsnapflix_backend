import {
  DEFAULT_FRONTEND_BASE_URL,
  DEFAULT_HE_BASE_URL,
  DEFAULT_HE_FIXED_MOBILE_NUMBER,
  DEFAULT_NON_HE_BASE_URL,
  DEFAULT_OFFER_CODE,
} from './cgw.constants';

export type CgwEnvName = 'staging' | 'production';

export type CgwSettings = {
  env: CgwEnvName;
  frontendBaseUrl: string;
  callbackUrl: string;
  heRedirectUrl: string;
  offerCode: string;
  initialOfferCode: string;
  heFixedMobileNumber: string;
  heBaseUrl: string;
  nonHeBaseUrl: string;
  jwtSecret: string;
};

export type CgwStatusMapping = {
  subscriptionStatus: 'active' | 'deactivated' | 'suspended';
  success: boolean;
  message: string;
};

export type ParsedCgwCallback = {
  msisdn: string | undefined;
  status: string | undefined;
  offerId: string | undefined;
  cgid: string | undefined;
};

export function resolveCgwEnv(value?: string, nodeEnv?: string): CgwEnvName {
  const env = (value || (nodeEnv === 'production' ? 'production' : 'staging'))
    .trim()
    .toLowerCase();
  return env === 'production' ? 'production' : 'staging';
}

export function buildCgwSettings(env: NodeJS.ProcessEnv): CgwSettings {
  const frontendBaseUrl =
    env.FRONTEND_BASE_URL || DEFAULT_FRONTEND_BASE_URL;
  const callbackUrl =
    env.CGW_CALLBACK_URL || `${frontendBaseUrl.replace(/\/+$/, '')}/api/callback`;
  const offerCode = env.CGW_OFFER_CODE || DEFAULT_OFFER_CODE;

  return {
    env: resolveCgwEnv(env.CGW_ENV, env.NODE_ENV),
    frontendBaseUrl,
    callbackUrl,
    heRedirectUrl: env.CGW_HE_REDIRECT_URL || callbackUrl,
    offerCode,
    initialOfferCode: env.CGW_INITIAL_OFFER_CODE || offerCode,
    heFixedMobileNumber:
      env.CGW_HE_MOBILE_NUMBER ||
      env.CGW_HE_FIXED_MOBILE_NUMBER ||
      DEFAULT_HE_FIXED_MOBILE_NUMBER,
    heBaseUrl: env.CGW_HE_BASE_URL || DEFAULT_HE_BASE_URL,
    nonHeBaseUrl: env.CGW_NON_HE_BASE_URL || DEFAULT_NON_HE_BASE_URL,
    jwtSecret: env.JWT_SECRET || '',
  };
}

export function normalizeMsisdn(value: unknown): string | null {
  if (!value) return null;

  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return `233${digits.slice(1)}`;

  return `233${digits}`;
}

export function generateFixedHEUrl(
  settings: CgwSettings,
  {
    offerCode = settings.offerCode,
    redirectUrl = settings.heRedirectUrl,
    mobileNumber = settings.heFixedMobileNumber,
  }: {
    offerCode?: string;
    redirectUrl?: string;
    mobileNumber?: string;
  } = {},
): string {
  const params = new URLSearchParams({
    OfferCode: offerCode,
    redirectUrl,
    mobileNumber,
  });

  return `${settings.heBaseUrl}?${params.toString()}`;
}

export function generateCGWUrl(
  settings: CgwSettings,
  msisdn: string | null,
  isHeaderEnrichment = true,
  offerCode = settings.offerCode,
  redirectUrl = settings.callbackUrl,
): string {
  const baseUrl = isHeaderEnrichment
    ? settings.heBaseUrl
    : settings.nonHeBaseUrl;

  const params = new URLSearchParams({
    OfferCode: offerCode,
    redirectUrl,
  });

  if (isHeaderEnrichment) {
    params.append('mobileNumber', msisdn || settings.heFixedMobileNumber);
  }

  if (!isHeaderEnrichment && msisdn) {
    params.append('mobileNumber', msisdn);
  }

  return `${baseUrl}?${params.toString()}`;
}

function firstDefinedValue(
  payload: Record<string, unknown> | null | undefined,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload?.[key];
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== '' &&
      String(value).trim().toLowerCase() !== 'undefined'
    ) {
      return String(value);
    }
  }
  return undefined;
}

export function parseCGWCallback(
  payload: Record<string, unknown>,
): ParsedCgwCallback {
  return {
    msisdn: firstDefinedValue(payload, [
      'msisdn',
      'MSISDN',
      'mobileNumber',
      'MobileNumber',
      'ani',
    ]),
    status: firstDefinedValue(payload, [
      'status',
      'Status',
      'result',
      'Result',
      'billingStatus',
      'BillingStatus',
      'resultCode',
    ]),
    offerId: firstDefinedValue(payload, [
      'offerId',
      'OfferId',
      'OfferCode',
      'offerCode',
    ]),
    cgid: firstDefinedValue(payload, ['cgid', 'CGID', 'cgId']),
  };
}

export function mapCGWStatus(
  statusCode: unknown,
  _options?: { offerCode?: string },
): CgwStatusMapping {
  const normalizedStatus = String(statusCode ?? '').trim().toLowerCase();

  const statusMap: Record<string, CgwStatusMapping> = {
    '200': { subscriptionStatus: 'active', success: true, message: 'Success' },
    '0': { subscriptionStatus: 'active', success: true, message: 'Success' },
    '00': { subscriptionStatus: 'active', success: true, message: 'Success' },
    ok: { subscriptionStatus: 'active', success: true, message: 'Success' },
    active: { subscriptionStatus: 'active', success: true, message: 'Success' },
    activated: {
      subscriptionStatus: 'active',
      success: true,
      message: 'Success',
    },
    success: { subscriptionStatus: 'active', success: true, message: 'Success' },
    successful: {
      subscriptionStatus: 'active',
      success: true,
      message: 'Success',
    },
    succuss: { subscriptionStatus: 'active', success: true, message: 'Success' },
    '1': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'Activation failed',
    },
    '112': {
      subscriptionStatus: 'suspended',
      success: false,
      message: 'Subscription in progress',
    },
    '11': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'No consent',
    },
    '12': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'Invalid Consent',
    },
    '13': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'Error consent',
    },
    '2': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'Low balance',
    },
    '63': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'Low balance',
    },
    '29': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'Low balance',
    },
    '26': {
      subscriptionStatus: 'deactivated',
      success: false,
      message: 'Low balance',
    },
  };

  return (
    statusMap[String(statusCode)] ||
    statusMap[normalizedStatus] || {
      subscriptionStatus: 'deactivated',
      success: false,
      message: normalizedStatus
        ? `Unknown status code: ${statusCode}`
        : 'The payment provider did not return a billing status. Please contact support if airtime was deducted.',
    }
  );
}
