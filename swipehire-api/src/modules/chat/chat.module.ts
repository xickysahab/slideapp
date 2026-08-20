import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Message } from '../../database/entities/message.entity';
import { SwipeMatchModule } from '../swipe-match/swipe-match.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/**
 * ChatModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: messages
 * Built in:    chat history, sending, read receipts
 *
 * Imports SwipeMatchModule for MatchService.findForParticipant rather than reading the matches
 * table directly. That single method is the "you must be in this match" check, and routing every
 * chat operation through it means there is one implementation of it rather than four.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Message]), SwipeMatchModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
