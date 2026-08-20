import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { UserRole } from '../../../database/entities/user.entity';
import { AuthService } from '../auth.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** What lands on `request.user` and is handed to controllers by the @CurrentUser() decorator. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Runs on every authenticated request, and deliberately re-reads the user rather than trusting
   * the token's claims. It costs one indexed primary-key lookup, and in exchange a deleted account
   * stops working immediately instead of staying live for up to fifteen minutes.
   *
   * The claims are still not trusted for authorisation: role comes from the row, not the token, so
   * a stale token can't assert a role the user no longer holds.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.authService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    return { id: user.id, email: user.email, role: user.role };
  }
}
