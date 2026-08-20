import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Pulls the authenticated user off the request, so controllers never read `req.user` directly and
 * never take a user id from the request body or a route param — which is the usual way an
 * ownership check ends up being performed against attacker-supplied identity.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
