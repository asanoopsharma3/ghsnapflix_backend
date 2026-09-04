import {
  MTN_CALLBACK_REQUESTED_PLAN_TO_SUBSCRIBE_PLAN,
  MTN_CALLBACK_ROTATE_REQUESTED_PLAN_ORDER,
  MTN_PLAN_ID_TO_SUBSCRIPTION_NAME,
} from './mtn.constants';

/** Normalize plan_id for MTN mapping (handles callback `_R` suffix, Excel scientific notation). */
export function normalizeMtnPlanId(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  let s = String(value).trim();
  if (!s) return null;

  if (/^[\d.]+e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      s = String(Math.trunc(n));
    }
  }

  if (/_R$/i.test(s)) {
    s = s.replace(/_R$/i, '');
  }

  return s.length > 0 ? s : null;
}

export function getMtnSubscriptionName(planId: string): string | null {
  const normalized = normalizeMtnPlanId(planId);
  if (!normalized) return null;

  return (
    MTN_PLAN_ID_TO_SUBSCRIPTION_NAME[
      normalized as keyof typeof MTN_PLAN_ID_TO_SUBSCRIPTION_NAME
    ] ?? null
  );
}

export function isKnownMtnPlanId(planId: string): boolean {
  return getMtnSubscriptionName(planId) !== null;
}

/** Map callback requestedPlan to a different subscribe plan (callback auto-subscribe only). */
export function resolveCallbackAutoSubscribePlanId(
  requestedPlan: unknown,
): string | null {
  const normalizedRequested = normalizeMtnPlanId(requestedPlan);
  if (!normalizedRequested) return null;

  const subscribePlanId =
    MTN_CALLBACK_REQUESTED_PLAN_TO_SUBSCRIBE_PLAN[
      normalizedRequested as keyof typeof MTN_CALLBACK_REQUESTED_PLAN_TO_SUBSCRIBE_PLAN
    ];

  if (!subscribePlanId || !isKnownMtnPlanId(subscribePlanId)) return null;

  return subscribePlanId;
}

export function getRotatingRequestedPlan(planIndex: number): string {
  const order = MTN_CALLBACK_ROTATE_REQUESTED_PLAN_ORDER;
  const index =
    ((planIndex % order.length) + order.length) % order.length;
  return order[index];
}
