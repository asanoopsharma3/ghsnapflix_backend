import {
  getMtnSubscriptionName,
  getRotatingRequestedPlan,
  normalizeMtnPlanId,
  resolveCallbackAutoSubscribePlanId,
} from './mtn-plan.util';

describe('mtn-plan.util', () => {
  it('strips _R suffix from callback appliededPlan', () => {
    expect(normalizeMtnPlanId('26801220000007963_R')).toBe(
      '26801220000007963',
    );
  });

  it('maps _R suffixed plan to subscription name from constants', () => {
    expect(getMtnSubscriptionName('26801220000007963_R')).toBe('SnapflixDaily');
    expect(getMtnSubscriptionName('26801220000007964')).toBe('SnapflixWeekly');
    expect(getMtnSubscriptionName('26801220000007965')).toBe('SnapflixMonthly');
  });

  it('returns null for unknown plan_id', () => {
    expect(getMtnSubscriptionName('99999999999999999')).toBeNull();
  });

  it('maps callback requestedPlan to next subscribe plan', () => {
    expect(resolveCallbackAutoSubscribePlanId('26801220000007963')).toBe(
      '26801220000007964',
    );
    expect(resolveCallbackAutoSubscribePlanId('26801220000007964')).toBe(
      '26801220000007965',
    );
    expect(resolveCallbackAutoSubscribePlanId('26801220000007965')).toBe(
      '26801220000007963',
    );
  });

  it('does not subscribe with same plan as requestedPlan', () => {
    const requested = '26801220000007964';
    const subscribe = resolveCallbackAutoSubscribePlanId(requested);
    expect(subscribe).not.toBe(requested);
    expect(subscribe).toBe('26801220000007965');
  });

  it('rotates requestedPlan order on each index', () => {
    expect(getRotatingRequestedPlan(0)).toBe('26801220000007963');
    expect(getRotatingRequestedPlan(1)).toBe('26801220000007964');
    expect(getRotatingRequestedPlan(2)).toBe('26801220000007965');
    expect(getRotatingRequestedPlan(3)).toBe('26801220000007963');
  });
});
