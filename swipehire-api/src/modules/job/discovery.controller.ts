import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { DiscoveryService } from './discovery.service';

class DiscoverJobsQuery {
  @IsOptional() @IsString() @MaxLength(64) cursor?: string;
}

class DiscoverCandidatesQuery {
  @IsUUID()
  jobId!: string;

  @IsOptional() @IsString() @MaxLength(64) cursor?: string;
}

/** The two deck endpoints. Each returns cards already scored and ranked. */
@Controller('discover')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('jobs')
  jobs(@CurrentUser() user: AuthenticatedUser, @Query() query: DiscoverJobsQuery) {
    return this.discovery.discoverJobs(user.id, user.role, query.cursor);
  }

  /** Scoped to one listing — a recruiter's deck only means something in the context of a job. */
  @Get('candidates')
  candidates(@CurrentUser() user: AuthenticatedUser, @Query() query: DiscoverCandidatesQuery) {
    return this.discovery.discoverCandidates(user.id, user.role, query.jobId, query.cursor);
  }
}
