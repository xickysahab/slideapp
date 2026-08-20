import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UpdateProfileDto, UpsertCompanyDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';

/**
 * Every route here is scoped to the caller. None of them takes a user id — the authenticated
 * principal is the only identity in play, so there is no id to tamper with (Demo Security
 * Baseline §1). Reading somebody *else's* profile is the discovery feed's job, and that applies
 * the blind-first rules; it does not go through here.
 */
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getMyProfile(user.id, user.role);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateProfile(user.id, user.role, dto);
  }

  /** PUT, not POST: the recruiter has exactly one company, so this is idempotent by nature. */
  @Put('company')
  upsertCompany(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCompanyDto) {
    return this.profiles.upsertCompany(user.id, user.role, dto);
  }
}
