import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AcceptInterviewDto, ProposeInterviewDto } from './dto/interview.dto';
import { InterviewService } from './interview.service';

/** Hangs off a match, like chat — an interview only exists inside a conversation. */
@Controller('matches/:id/interview')
@UseGuards(JwtAuthGuard)
export class InterviewController {
  constructor(private readonly interviews: InterviewService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) matchId: string) {
    return this.interviews.findForMatch(matchId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  propose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: ProposeInterviewDto,
  ) {
    return this.interviews.propose(matchId, user.id, user.role, dto.slots);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: AcceptInterviewDto,
  ) {
    return this.interviews.accept(matchId, user.id, user.role, dto.slotIndex);
  }
}
