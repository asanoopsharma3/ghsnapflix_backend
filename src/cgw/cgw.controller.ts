import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CgwActivateGuard } from './cgw-activate.guard';
import { sendCgwResult } from './cgw-legacy-callback.controller';
import { CgwService, type CgwActionResult } from './cgw.service';

@Controller('cgw')
export class CgwController {
  constructor(private readonly cgwService: CgwService) {}

  /** HE: redirect to MTN CGW `/cgw/redirect/he` with fixed/header MSISDN. */
  @Get('he')
  @Post('he')
  async startHeaderEnrichmentRedirect(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.send(res, await this.cgwService.startHeaderEnrichmentRedirect(req));
  }

  /** Non-HE: redirect to MTN CGW `/cgw/redirect/nhe` with typed MSISDN. */
  @Get('nhe')
  @Post('nhe')
  async generateNonHeRedirectUrl(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.send(res, await this.cgwService.generateCGWRedirectUrl(req, true));
  }

  /** Same as original POST /api/cgw/activate — HE if header MSISDN exists, else NHE. */
  @Post('activate')
  @UseGuards(CgwActivateGuard)
  async activateCGWSubscription(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.send(res, await this.cgwService.generateCGWRedirectUrl(req));
  }

  private send(res: Response, result: CgwActionResult): void {
    sendCgwResult(res, result);
  }
}
