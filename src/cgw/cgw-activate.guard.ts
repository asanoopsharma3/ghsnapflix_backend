import { timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class CgwActivateGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const configuredSecret = this.config.get<string>('SDP_CALLBACK_SECRET');
    const allowedIps = String(
      this.config.get<string>('SDP_CALLBACK_ALLOWED_IPS') || '',
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const forwardedIp = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    const requestIp = forwardedIp || req.socket.remoteAddress || '';

    if (allowedIps.length && !allowedIps.includes(requestIp)) {
      throw new HttpException(
        { success: false, message: 'Forbidden' },
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      configuredSecret &&
      !this.safeEqual(this.getProvidedSecret(req), configuredSecret)
    ) {
      throw new HttpException(
        { success: false, message: 'Invalid callback credentials' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hasPayload =
      Object.keys(req.query || {}).length > 0 ||
      (req.body && Object.keys(req.body).length > 0);

    if (!hasPayload) {
      throw new HttpException(
        { success: false, message: 'Callback payload is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!configuredSecret && !allowedIps.length) {
      console.warn(
        '[SDP CALLBACK SECURITY] Configure SDP_CALLBACK_SECRET or SDP_CALLBACK_ALLOWED_IPS in production.',
      );
    }

    return true;
  }

  private getProvidedSecret(req: Request): string {
    const authorization = req.headers.authorization || '';
    const bearer = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';

    return String(
      req.headers['x-callback-secret'] ||
        req.headers['x-sdp-callback-secret'] ||
        bearer,
    );
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(String(left || ''));
    const rightBuffer = Buffer.from(String(right || ''));
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
