import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CgwService, type CgwActionResult } from './cgw.service';

/** Same as Downloads backend: app.all("/api/callback", handleCGWCallback). */
@Controller('api/callback')
export class CgwLegacyCallbackController {
  constructor(private readonly cgwService: CgwService) {}

  @All()
  async handleCGWCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    sendCgwResult(res, await this.cgwService.handleCGWCallback(req));
  }
}

export function sendCgwResult(res: Response, result: CgwActionResult): void {
  if (result.kind === 'redirect') {
    res.redirect(result.url);
    return;
  }
  if (result.kind === 'ok') {
    res.status(200).send(result.body);
    return;
  }
  res.status(result.status).json(result.body);
}
