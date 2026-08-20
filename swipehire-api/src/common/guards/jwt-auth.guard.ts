import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Requires a valid, unexpired access token whose subject still exists.
 *
 * Authentication only — it answers "who is this", never "may they touch this record". Every
 * endpoint taking a resource ID still needs its own ownership check in the service layer
 * (Demo Security Baseline §1). A guard that passes is not permission.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
