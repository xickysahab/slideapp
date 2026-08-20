import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RecordSwipeDto, SetOutcomeDto } from './dto/swipe.dto';
import { MatchService } from './match.service';
import { SwipeService } from './swipe.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class SwipeMatchController {
  constructor(
    private readonly swipes: SwipeService,
    private readonly matches: MatchService,
  ) {}

  /**
   * The only way a match ever comes into being.
   *
   * Note what is absent: there is no POST /matches. A match is a server-derived consequence of two
   * independent swipes and can never be asserted by a client (Demo Security Baseline §1).
   */
  @Post('swipes')
  @HttpCode(HttpStatus.OK)
  swipe(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordSwipeDto) {
    return this.swipes.recordSwipe(user.id, user.role, dto);
  }

  @Get('matches')
  listMatches(@CurrentUser() user: AuthenticatedUser) {
    return this.matches.listMine(user.id);
  }

  @Get('matches/:id')
  getMatch(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.matches.findForParticipant(id, user.id);
  }

  /** The Outcome tail: Hired archives the match and fills the job; Not Selected closes it. */
  @Patch('matches/:id/outcome')
  setOutcome(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOutcomeDto,
  ) {
    return this.matches.setOutcome(id, user.id, user.role, dto.outcome, dto.note);
  }
}
