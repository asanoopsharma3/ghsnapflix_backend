import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MtnTokenCache } from '../entities/mtn-token-cache.entity';

type MtnTokenResponse = {
  access_token: string;
  expires_in: string | number;
  token_type?: string;
};

const TOKEN_CACHE_ID = 1;
const EXPIRY_BUFFER_SECONDS = 60;

@Injectable()
export class MtnAuthService {
  private readonly logger = new Logger(MtnAuthService.name);
  private memoryToken: { accessToken: string; expiresAt: Date } | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MtnTokenCache)
    private readonly tokenRepo: Repository<MtnTokenCache>,
  ) {}

  async getAccessToken(): Promise<string> {
    const cached = await this.getValidCachedToken();
    if (cached) return cached;

    if (!this.refreshPromise) {
      this.refreshPromise = this.fetchAndCacheToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private async getValidCachedToken(): Promise<string | null> {
    const now = new Date();

    if (this.memoryToken && this.memoryToken.expiresAt > now) {
      return this.memoryToken.accessToken;
    }

    const row = await this.tokenRepo.findOne({ where: { id: TOKEN_CACHE_ID } });
    if (row && row.expiresAt > now) {
      this.memoryToken = {
        accessToken: row.accessToken,
        expiresAt: row.expiresAt,
      };
      return row.accessToken;
    }

    return null;
  }

  private async fetchAndCacheToken(): Promise<string> {
    const baseUrl = this.config.get<string>(
      'MTN_API_BASE_URL',
      'https://api.mtn.com',
    );
    const clientId = this.config.get<string>('MTN_CLIENT_ID');
    const clientSecret = this.config.get<string>('MTN_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('MTN_CLIENT_ID and MTN_CLIENT_SECRET must be set in .env');
    }

    const url = `${baseUrl}/v1/oauth/access_token?grant_type=client_credentials`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
    });

    this.logger.log('Requesting new MTN OAuth access token');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`MTN token request failed (${response.status}): ${text}`);
      throw new Error(`MTN token request failed: HTTP ${response.status}`);
    }

    let data: MtnTokenResponse;
    try {
      data = JSON.parse(text) as MtnTokenResponse;
    } catch {
      throw new Error('MTN token response is not valid JSON');
    }

    if (!data.access_token) {
      throw new Error('MTN token response missing access_token');
    }

    const expiresIn = parseInt(String(data.expires_in ?? '3599'), 10);
    const safeTtl = Math.max(expiresIn - EXPIRY_BUFFER_SECONDS, 60);
    const expiresAt = new Date(Date.now() + safeTtl * 1000);

    await this.tokenRepo.save({
      id: TOKEN_CACHE_ID,
      accessToken: data.access_token,
      expiresAt,
    });

    this.memoryToken = {
      accessToken: data.access_token,
      expiresAt,
    };

    this.logger.log(`MTN access token cached, expires in ${safeTtl}s`);
    return data.access_token;
  }
}
