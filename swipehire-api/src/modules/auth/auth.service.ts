import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User, type UserRole } from '../../database/entities/user.entity';
import type { LoginDto, SignupDto } from './dto/auth.dto';
import type { GoogleIdentity } from './google-auth.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string; role: UserRole };
}

/** Access tokens are short-lived; the refresh token is what carries the session (Security Baseline §1). */
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      // Deliberate trade-off: this leaks that an address is registered. Signup can't avoid it —
      // the account either gets created or it doesn't — and a vague error here just means a
      // confused user retrying. Login below does NOT make the same distinction.
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        passwordHash: await this.hashPassword(dto.password),
        role: dto.role,
      }),
    );

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { email: dto.email } });

    /**
     * Both "no such user" and "wrong password" return the same error. The verify call still runs
     * against a dummy hash when the user is missing, so the response time doesn't quietly reveal
     * which case it was — a timing difference is as good as an error message to anyone enumerating
     * addresses.
     */
    const valid = user?.passwordHash
      ? await this.verifyPassword(user.passwordHash, dto.password)
      : await this.burnTime(dto.password);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  /**
   * Signs in (or registers) through a Google ID token that GoogleAuthService has already verified.
   *
   * Accounts are matched on the verified email address, so signing up with a password and later
   * using "Continue with Google" lands on the same account rather than creating a second one. That
   * only holds because the email came from a token Google signed and `email_verified` was checked —
   * matching on a client-supplied address would be an account takeover.
   */
  async loginWithGoogle(
    identity: GoogleIdentity,
    role?: UserRole,
  ): Promise<AuthResult & { isNewUser: boolean }> {
    const existing = await this.users.findOne({ where: { email: identity.email } });

    if (existing) {
      // Role is deliberately not updated from the request. It's settled at signup, and letting a
      // client change it by re-authenticating would turn a candidate into a recruiter for free.
      return { ...(await this.issueTokens(existing)), isNewUser: false };
    }

    if (!role) {
      // The client is expected to have collected this already — role selection precedes auth in the
      // product flow — so this is a contract violation worth naming precisely rather than a 500.
      throw new BadRequestException('A role is required the first time you sign in with Google');
    }

    const user = await this.users.save(
      // No password hash: this account has never had a password, and null records that honestly
      // rather than storing a hash of something unguessable and pretending it could log in.
      this.users.create({ email: identity.email, passwordHash: null, role }),
    );

    return { ...(await this.issueTokens(user)), isNewUser: true };
  }

  /**
   * Exchanges a refresh token for a new access token.
   *
   * Two independent checks: the JWT signature must verify, AND the token's hash must match a row
   * that is neither revoked nor expired. The signature alone is not enough — that's what makes
   * logout able to actually end a session rather than politely asking the client to forget it.
   */
  async refresh(rawToken: string): Promise<AuthTokens> {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(rawToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hashToken(rawToken) },
    });

    if (!stored || !stored.isUsable()) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Invalid or expired session');

    // Rotation-on-refresh is explicitly deferred for the demo (Security Baseline §1), so the
    // existing refresh token stays valid and only a fresh access token is minted.
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: rawToken,
    };
  }

  /** Revokes one session. Idempotent: logging out with an already-dead token is not an error. */
  async logout(rawToken: string): Promise<void> {
    await this.refreshTokens.update(
      // Scoped to still-live rows so a repeat logout doesn't overwrite the original revocation
      // timestamp — that timestamp is the only record of when the session actually ended.
      { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Used by JwtStrategy to confirm the subject of a token still exists. */
  async findById(userId: string): Promise<User | null> {
    return this.users.findOne({ where: { id: userId } });
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const accessToken = await this.signAccessToken(user);

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    // A random jti makes each refresh token distinct even when issued to the same user in the same
    // second, so the unique index on token_hash can't collide.
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomBytes(16).toString('hex') },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
      },
    );

    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        revokedAt: null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );
  }

  /**
   * Argon2id per Security Baseline §1. The parameters are the library defaults, which track the
   * current OWASP guidance — pinning hand-chosen numbers here would mean they stop tracking it.
   */
  private hashPassword(password: string): Promise<string> {
    return argonHash(password);
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argonVerify(hash, password);
    } catch {
      return false;
    }
  }

  /** Spends roughly one verify's worth of time so a missing account isn't faster than a wrong password. */
  private async burnTime(password: string): Promise<false> {
    await argonHash(password);
    return false;
  }

  /**
   * SHA-256, not Argon2. This is a 300-bit random token, not a human-chosen password: there is no
   * guessable keyspace to slow an attacker down through, and refresh runs on every app foreground,
   * so a deliberately slow hash here would be paid on every request for no security gain.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
