import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { GoogleAuthDto, LoginDto, RefreshDto, SignupDto } from './dto/auth.dto';
import { GoogleAuthService } from './google-auth.service';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post('login')
  // 200 rather than 201: logging in doesn't create a resource, and the mobile client shouldn't
  // have to special-case a status code that says it did.
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /**
   * Takes the refresh token in the body rather than reading the access token from the header: the
   * access token is expiring anyway, and it's the refresh token that actually needs revoking.
   * Unauthenticated on purpose — someone holding a valid refresh token should be able to kill it
   * even if their access token has already expired.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  /**
   * Google sign-in. The client does the Google flow and posts the resulting ID token; the server
   * verifies it with Google before trusting any of its claims.
   *
   * `role` is only needed the first time a given Google account appears — role selection happens
   * before auth in the product flow, so the client already has it.
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(@Body() dto: GoogleAuthDto) {
    const identity = await this.googleAuth.verify(dto.idToken);
    return this.auth.loginWithGoogle(identity, dto.role);
  }

  /** Lets the app confirm a stored token is still good on launch, and recover the user's role. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
