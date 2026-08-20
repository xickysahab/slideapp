import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verifies Google ID tokens (DEMO-03, Google sign-in half).
 *
 * The client performs the Google sign-in and sends the resulting ID token here; the server verifies
 * it against Google's published keys before trusting a single field. The client is never asked
 * "which Google account is this?" — that answer would be trivially forgeable, and accepting it would
 * let anyone sign in as anyone by posting an email address.
 *
 * Only the client ID is needed, as the expected audience. The OAuth client *secret* belongs to the
 * authorization-code flow, which a mobile app can't keep secret and doesn't use here.
 *
 * Several client IDs may be configured (Expo Go, iOS, Android each get their own from Google), so
 * GOOGLE_OAUTH_CLIENT_ID accepts a comma-separated list and any of them is an acceptable audience.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly client = new OAuth2Client();
  private readonly audiences: string[];

  constructor(config: ConfigService) {
    this.audiences = (config.get<string>('GOOGLE_OAUTH_CLIENT_ID') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  get isConfigured(): boolean {
    return this.audiences.length > 0;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.isConfigured) {
      // A 503 rather than a 401: the caller did nothing wrong, the server just isn't set up.
      throw new ServiceUnavailableException('Google sign-in is not configured on this server');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audiences });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(`Google ID token rejected: ${(err as Error).message}`);
      throw new UnauthorizedException('Google sign-in failed');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Google sign-in failed');
    }

    /**
     * `email_verified` is checked, not merely read (full Security doc §1). Google will happily
     * issue a token for an unverified address on some account types, and treating one as proven
     * identity would let someone claim an email they don't control — and then, on a later real
     * signup, collide with the actual owner's account.
     */
    if (!payload.email_verified) {
      throw new UnauthorizedException('This Google account has no verified email address');
    }

    return {
      email: payload.email,
      emailVerified: true,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
