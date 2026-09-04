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
  statusMessage: string | undefined;
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
      'statusCode',
      'StatusCode',
    ]),
    statusMessage: firstDefinedValue(payload, [
      'statusMessage',
      'StatusMessage',
      'resultMessage',
      'ResultMessage',
      'message',
      'Message',
      'reason',
      'Reason',
      'description',
      'Description',
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

function mapping(
  subscriptionStatus: CgwStatusMapping['subscriptionStatus'],
  success: boolean,
  message: string,
): CgwStatusMapping {
  return { subscriptionStatus, success, message };
}

const SUCCESS = mapping('active', true, 'Subscription successful.');
const ACTIVATION_FAILED = mapping(
  'deactivated',
  false,
  'Activation failed. Please try again.',
);
const IN_PROGRESS = mapping(
  'suspended',
  false,
  'Subscription in progress. Please wait a moment.',
);
const NO_CONSENT = mapping(
  'deactivated',
  false,
  'No consent. Please accept and try again.',
);
const INVALID_CONSENT = mapping(
  'deactivated',
  false,
  'Invalid consent. Please try again.',
);
const ERROR_CONSENT = mapping(
  'deactivated',
  false,
  'Consent error. Please try again.',
);
const LOW_BALANCE = mapping(
  'deactivated',
  false,
  'Low balance. Please recharge and try again.',
);
const ALREADY_SUBSCRIBED = mapping(
  'active',
  true,
  'You are already subscribed.',
);
const DUPLICATE = mapping(
  'deactivated',
  false,
  'Duplicate subscription. Please try again later.',
);
const INVALID_OTP = mapping(
  'deactivated',
  false,
  'Invalid OTP. Please try again.',
);
const UNKNOWN_FAIL = mapping(
  'deactivated',
  false,
  'We could not complete your subscription. Please try again.',
);

function normalizeLookup(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, '');
}

function mapByStatusMessage(statusMessage: unknown): CgwStatusMapping | null {
  const key = normalizeLookup(statusMessage);
  if (!key) return null;

  const exact: Record<string, CgwStatusMapping> = {
    success: SUCCESS,
    succuss: SUCCESS,
    successful: SUCCESS,
    activationfailed: ACTIVATION_FAILED,
    subscriptioninprogress: IN_PROGRESS,
    noconsent: NO_CONSENT,
    invalidconsent: INVALID_CONSENT,
    errorconsent: ERROR_CONSENT,
    consenterror: ERROR_CONSENT,
    lowbalance: LOW_BALANCE,
    alreadysubscribedcase: ALREADY_SUBSCRIBED,
    alreadysubscribed: ALREADY_SUBSCRIBED,
    failedduplicatesubscription: DUPLICATE,
    duplicatesubscription: DUPLICATE,
    invalidotpcase: INVALID_OTP,
    invalidotp: INVALID_OTP,
  };

  if (exact[key]) return exact[key];
  if (key.includes('invalidotp')) return INVALID_OTP;
  if (key.includes('lowbalance') || key.includes('insufficient')) {
    return LOW_BALANCE;
  }
  if (key.includes('alreadysubscribed')) return ALREADY_SUBSCRIBED;
  if (key.includes('duplicate')) return DUPLICATE;
  if (key.includes('noconsent')) return NO_CONSENT;
  if (key.includes('invalidconsent')) return INVALID_CONSENT;
  if (key.includes('errorconsent') || key.includes('consenterror')) {
    return ERROR_CONSENT;
  }
  if (key.includes('inprogress')) return IN_PROGRESS;
  if (key.includes('activationfailed')) return ACTIVATION_FAILED;
  if (key === 'success' || key.includes('successful')) return SUCCESS;
  return null;
}

export function mapCGWStatus(
  statusCode: unknown,
  options?: { offerCode?: string; statusMessage?: string },
): CgwStatusMapping {
  const code = String(statusCode ?? '').trim();
  const codeKey = code.toLowerCase();
  const fromMessage = mapByStatusMessage(options?.statusMessage);
  const statusMap: Record<string, CgwStatusMapping> = {
    '200': SUCCESS,
    '0': SUCCESS,
    '00': SUCCESS,
    ok: SUCCESS,
    active: SUCCESS,
    activated: SUCCESS,
    success: SUCCESS,
    successful: SUCCESS,
    succuss: SUCCESS,
    '1': ACTIVATION_FAILED,
    '112': IN_PROGRESS,
    '11': NO_CONSENT,
    '12': INVALID_CONSENT,
    '13': ERROR_CONSENT,
    '2': LOW_BALANCE,
    '63': LOW_BALANCE,
    '29': LOW_BALANCE,
    '26': LOW_BALANCE,
    '55': LOW_BALANCE,
    '111': LOW_BALANCE,
    '9': ALREADY_SUBSCRIBED,
    '115': ALREADY_SUBSCRIBED,
    '644': DUPLICATE,
    '91': INVALID_OTP,
    '186': INVALID_OTP,
  };
  const fromCode = statusMap[code] || statusMap[codeKey];

  // Codes 1 and 13 are reused: activation/consent vs Invalid OTP.
  if (code === '1' || code === '13') {
    return fromMessage || fromCode || UNKNOWN_FAIL;
  }

  return fromCode || fromMessage || UNKNOWN_FAIL;
}
