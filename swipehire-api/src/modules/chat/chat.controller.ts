import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ChatService } from './chat.service';
import { MessageHistoryQuery, SendMessageDto } from './dto/chat.dto';

/**
 * Chat hangs off a match id, because a match *is* the conversation (Architecture §4.1). There is no
 * conversation id anywhere, and no endpoint that opens a thread with someone you haven't matched
 * with — the absence of a cold-message path is structural, not a check that could be forgotten.
 */
@Controller('matches/:id/messages')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Query() query: MessageHistoryQuery,
  ) {
    return this.chat.listMessages(matchId, user.id, query.before);
  }

  @Post()
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(matchId, user.id, dto.content);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) matchId: string) {
    return this.chat.markRead(matchId, user.id);
  }
}
