import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { MtnOtpService } from './mtn-otp.service';

type SendOtpBody = {
  msisdn?: string;
};

type VerifyOtpBody = {
  msisdn?: string;
  otp?: string;
};

@Controller('mtn/otp')
export class MtnOtpController {
  constructor(private readonly otpService: MtnOtpService) {}

  /** Send a 4-digit OTP via MTN outbound SMS API. */
  @Post('send')
  @HttpCode(200)
  async sendOtp(@Body() body: SendOtpBody) {
    if (!body?.msisdn?.trim()) {
      return {
        ok: false,
        errorMessage: 'msisdn is required',
      };
    }

    const result = await this.otpService.sendOtp(body.msisdn.trim());

    return {
      ok: result.ok,
      statusCode: result.statusCode,
      statusMessage: result.statusMessage,
      transactionId: result.transactionId,
      data: result.deliveryStatus ? { status: result.deliveryStatus } : null,
      clientCorrelator: result.clientCorrelator,
      errorMessage: result.errorMessage,
      ...(result.devMode ? { devMode: true, devOtp: result.devOtp } : {}),
    };
  }

  /** Verify the 4-digit OTP sent to msisdn. Required before subscribe. */
  @Post('verify')
  @HttpCode(200)
  async verifyOtp(@Body() body: VerifyOtpBody) {
    if (!body?.msisdn?.trim()) {
      return {
        ok: false,
        verified: false,
        errorMessage: 'msisdn is required',
      };
    }

    if (!body?.otp?.trim()) {
      return {
        ok: false,
        verified: false,
        errorMessage: 'otp is required',
      };
    }

    const result = await this.otpService.verifyOtp(
      body.msisdn.trim(),
      body.otp.trim(),
    );

    return {
      ok: result.ok,
      verified: result.verified,
      errorMessage: result.errorMessage,
    };
  }
}
