import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateJobDto, UpdateJobDto, UpdateJobStatusDto } from './dto/job.dto';
import { JobService } from './job.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobController {
  constructor(private readonly jobs: JobService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto) {
    return this.jobs.create(user.id, user.role, dto);
  }

  /** The recruiter dashboard: their own listings, newest first. */
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.listMine(user.id, user.role);
  }

  /**
   * ParseUUIDPipe rejects a malformed id with a 400 before it reaches the database, which also
   * means an id that isn't even a UUID can't be used to probe for anything.
   */
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobs.update(id, user.id, user.role, dto);
  }

  /** Separate from PATCH :id so closing a listing is an explicit act, not a stray field. */
  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobs.setStatus(id, user.id, user.role, dto.status);
  }
}
