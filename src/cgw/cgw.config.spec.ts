import {
  buildCgwSettings,
  generateCGWUrl,
  generateFixedHEUrl,
  mapCGWStatus,
  normalizeMsisdn,
  parseCGWCallback,
} from './cgw.config';
import {
  DEFAULT_HE_BASE_URL,
  DEFAULT_NON_HE_BASE_URL,
} from './cgw.constants';

const settings = buildCgwSettings({
  CGW_ENV: 'production',
  FRONTEND_BASE_URL: 'http://localhost:5174',
  CGW_CALLBACK_URL: 'http://localhost:3002/api/callback',
  CGW_HE_REDIRECT_URL: 'http://localhost:3002/api/callback',
  CGW_OFFER_CODE: '9923310010',
  CGW_HE_MOBILE_NUMBER: '99999999999',
});

describe('cgw.config', () => {
  it('normalizes Ghana MSISDN values', () => {
    expect(normalizeMsisdn('0244123456')).toBe('233244123456');
    expect(normalizeMsisdn('+233244123456')).toBe('233244123456');
    expect(normalizeMsisdn('244123456')).toBe('233244123456');
    expect(normalizeMsisdn(null)).toBeNull();
  });

  it('builds HE redirect URL with OfferCode, redirectUrl, mobileNumber', () => {
    const url = generateFixedHEUrl(settings);
    expect(url.startsWith(`${DEFAULT_HE_BASE_URL}?`)).toBe(true);

    const params = new URL(url).searchParams;
    expect(params.get('OfferCode')).toBe('9923310010');
    expect(params.get('redirectUrl')).toBe(
      'http://localhost:3002/api/callback',
    );
    expect(params.get('mobileNumber')).toBe('99999999999');
  });

  it('builds Non-HE URL with typed MSISDN', () => {
    const url = generateCGWUrl(
      settings,
      '233244123456',
      false,
      '9923310010',
      'http://localhost:3002/api/callback',
    );
    expect(url.startsWith(`${DEFAULT_NON_HE_BASE_URL}?`)).toBe(true);

    const params = new URL(url).searchParams;
    expect(params.get('OfferCode')).toBe('9923310010');
    expect(params.get('mobileNumber')).toBe('233244123456');
    expect(params.get('redirectUrl')).toBe(
      'http://localhost:3002/api/callback',
    );
  });

  it('builds HE URL from header-enriched MSISDN', () => {
    const url = generateCGWUrl(settings, '233244123456', true);
    expect(url.startsWith(`${DEFAULT_HE_BASE_URL}?`)).toBe(true);
    expect(new URL(url).searchParams.get('mobileNumber')).toBe('233244123456');
  });

  it('parses CGW callback payload aliases', () => {
    expect(
      parseCGWCallback({
        MobileNumber: '233244123456',
        Result: '200',
        OfferCode: '9923310010',
        cgId: 'abc',
      }),
    ).toEqual({
      msisdn: '233244123456',
      status: '200',
      offerId: '9923310010',
      cgid: 'abc',
    });
  });

  it('maps CGW status codes', () => {
    expect(mapCGWStatus('200').success).toBe(true);
    expect(mapCGWStatus(0).success).toBe(true);
    expect(mapCGWStatus('2').message).toBe('Low balance');
    expect(mapCGWStatus('11').message).toBe('No consent');
    expect(mapCGWStatus('unknown').success).toBe(false);
  });
});
