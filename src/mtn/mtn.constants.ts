/** Static subscription body fields. MSISDN is in the URL; subscriptionId comes from Excel plan_id. */
export const MTN_SUBSCRIPTION_PAYLOAD = {
  subscriptionProviderId: 'CSM',
  registrationChannel: 'WAP',
  subscriptionPaymentSource: 'Airtime',
  sendSMSNotification: 'false',
  'auto-renew': 'true',
} as const;

/** plan_id (subscriptionId) → subscriptionName for MTN request and subscription_misdns log. */
export const MTN_PLAN_ID_TO_SUBSCRIPTION_NAME = {
  '26801220000007963': 'SnapflixDaily',
  '26801220000007964': 'SnapflixWeekly',
  '26801220000007965': 'SnapflixMonthly',
} as const;

/**
 * Callback auto-subscribe: requestedPlan → next plan for MTN subscription
 * (never subscribe with the same plan as requestedPlan).
 */
export const MTN_CALLBACK_REQUESTED_PLAN_TO_SUBSCRIBE_PLAN = {
  '26801220000007963': '26801220000007964',
  '26801220000007964': '26801220000007965',
  '26801220000007965': '26801220000007963',
} as const;

/** Order for rotating which requestedPlan to fetch on each cron run. */
export const MTN_CALLBACK_ROTATE_REQUESTED_PLAN_ORDER = [
  '26801220000007963',
  '26801220000007964',
  '26801220000007965',
] as const;

/** Request header transactionid: 8 chars, letter-digit-letter-digit pattern (e.g. a1b2c3d4). */
export const MTN_REQUEST_TRANSACTION_ID_LENGTH = 8;

export const MTN_UPLOAD_DIR = 'storage/uploads/mtn';
export const MTN_ENQUEUE_CHUNK_SIZE = 500;
export const MTN_QUEUE_CHUNK_SIZE = 10;
export const MTN_QUEUE_INTERVAL_MS = 5000;
/** Excel batch queue cron. Keep code; off until the table exists / we need it. */
export const MTN_QUEUE_ENABLED =
  process.env.MTN_QUEUE_ENABLED === 'true';

/** Callback auto-subscription cron. Off unless explicitly enabled. */
export const MTN_CALLBACK_AUTO_ENABLED =
  process.env.MTN_CALLBACK_AUTO_ENABLED === 'true';
export const MTN_CALLBACK_AUTO_INTERVAL_MS = parseInt(
  process.env.MTN_CALLBACK_AUTO_INTERVAL_MS ?? '300000',
  10,
);
export const MTN_CALLBACK_AUTO_FETCH_LIMIT = parseInt(
  process.env.MTN_CALLBACK_AUTO_FETCH_LIMIT ?? '10',
  10,
);

/** OTP SMS body template; `{otp}` is replaced with the generated 4-digit code. */
export const MTN_OTP_MESSAGE_TEMPLATE =
  'Your Snapflix verification code is {otp}. Do not share this code.';

export const MTN_OTP_LENGTH = 4;
export const MTN_OTP_EXPIRY_MINUTES = 10;

/** How long a verified MSISDN can subscribe after OTP verify. */
export const MTN_OTP_VERIFIED_EXPIRY_MINUTES = 30;

/** Fixed OTP used when MTN_OTP_DEV_BYPASS=true (local testing only). */
export const MTN_OTP_DEV_CODE = '1234';
