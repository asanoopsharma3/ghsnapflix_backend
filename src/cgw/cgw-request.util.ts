import type { IncomingHttpHeaders } from 'http';
import type { Request } from 'express';

export type CgwRequest = Request & { msisdn?: string };

export function getHeaderMsisdn(
  headers: IncomingHttpHeaders,
  requestMsisdn?: unknown,
): string | undefined {
  const fromRequest = requestMsisdn ? String(requestMsisdn) : '';
  const value =
    fromRequest ||
    headers.msisdn ||
    headers['x-msisdn'] ||
    headers['x-up-calling-line-id'];

  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export function getClientMeta(req: Request): { ip: string; userAgent: string } {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  return {
    ip: String(forwardedIp || req.socket.remoteAddress || ''),
    userAgent: String(req.headers['user-agent'] || ''),
  };
}

export function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function headerRecord(
  headers: IncomingHttpHeaders,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(headers)) as Record<string, unknown>;
}
