import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { getHeaderMsisdn, type CgwRequest } from './cgw-request.util';

@Injectable()
export class HeaderEnrichmentMiddleware implements NestMiddleware {
  use(req: CgwRequest, _res: Response, next: NextFunction): void {
    const msisdn = getHeaderMsisdn(req.headers);
    if (msisdn) {
      req.msisdn = msisdn;
    }
    next();
  }
}
