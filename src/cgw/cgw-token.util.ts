import { createHmac } from 'crypto';

import { JWT_TTL_SECONDS } from './cgw.constants';

function toBase64Url(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** Daily subscription JWT: valid for 1 day, then user must subscribe again. */
export function createCgwToken(id: string, secret: string): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS,
    }),
  );
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${header}.${payload}.${signature}`;
}

export function verifyCgwToken(
  token: string,
  secret: string,
): { id: string } | null {
  if (!token || !secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  if (expected !== signature) return null;

  try {
    const data = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { id?: unknown; exp?: unknown };
    if (typeof data.exp === 'number' && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (data.id === undefined || data.id === null) return null;
    return { id: String(data.id) };
  } catch {
    return null;
  }
}
