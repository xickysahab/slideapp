import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';

import { Message } from '../../database/entities/message.entity';
import { RealtimeGateway } from '../../shared/realtime/realtime.gateway';
import { MatchService } from '../swipe-match/match.service';

const PAGE_SIZE = 50;

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  sentAt: Date;
  readAt: Date | null;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly matchService: MatchService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Thread history, newest-first and cursor-paginated.
   *
   * Participation is re-checked here, not assumed from a prior socket connection. Demo Security
   * Baseline §1 requires the match check on every history read as well as every send — there is no
   * path to a message that doesn't pass through it.
   */
  async listMessages(matchId: string, userId: string, before?: string): Promise<{ items: ChatMessage[]; nextCursor: string | null }> {
    await this.matchService.findForParticipant(matchId, userId);

    const rows = await this.messages.find({
      where: { matchId, ...(before ? { id: LessThan(before) } : {}) },
      order: { id: 'DESC' },
      take: PAGE_SIZE + 1,
    });

    const hasMore = rows.length > PAGE_SIZE;
    const items = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(this.toChatMessage);

    return {
      items,
      // BIGSERIAL ids are monotonic, so the id itself is a valid keyset cursor — no offset needed.
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Sends a message.
   *
   * Deliberately a REST write with socket *delivery*, rather than a socket write.
   *
   * The demo could accept messages over the socket instead, and that's how the full spec's gateway
   * works. But two write paths means the match check, the closed-thread rule and the validation all
   * have to be right twice — and Security Baseline §1 names "re-validated on every single send" as
   * the thing not to get wrong. One path, checked once, delivered instantly is the same experience
   * with half the surface.
   */
  async sendMessage(matchId: string, userId: string, content: string): Promise<ChatMessage> {
    const match = await this.matchService.findForParticipant(matchId, userId);

    if (match.status !== 'active') {
      // A closed or archived thread stays readable — the history is part of what happened — but
      // it doesn't accept new messages.
      throw new BadRequestException('This conversation has been closed');
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) throw new BadRequestException('Message cannot be empty');

    const saved = await this.messages.save(
      this.messages.create({ matchId, senderId: userId, content: trimmed, readAt: null }),
    );

    const payload = this.toChatMessage(saved);
    const recipientId = match.candidateId === userId ? match.recruiterId : match.candidateId;

    // The sender gets it too: their other devices need the same message, and echoing back confirms
    // the write rather than leaving the client to assume it landed.
    this.realtime.emitToUsers([recipientId, userId], 'message:new', payload);

    return payload;
  }

  /**
   * Marks everything the other party sent as read.
   *
   * Scoped to messages *not* sent by the caller, so a client can't mark its own messages read and
   * quietly clear the other side's unread badge.
   */
  async markRead(matchId: string, userId: string): Promise<{ updated: number }> {
    const match = await this.matchService.findForParticipant(matchId, userId);
    const counterpartyId = match.candidateId === userId ? match.recruiterId : match.candidateId;

    const result = await this.messages.update(
      { matchId, senderId: counterpartyId, readAt: IsNull() },
      { readAt: new Date() },
    );

    const updated = result.affected ?? 0;
    if (updated > 0) {
      this.realtime.emitToUser(counterpartyId, 'message:read', { matchId, readerId: userId });
    }

    return { updated };
  }

  private toChatMessage(row: Message): ChatMessage {
    return {
      id: String(row.id),
      matchId: row.matchId,
      senderId: row.senderId,
      content: row.content,
      sentAt: row.sentAt,
      readAt: row.readAt,
    };
  }
}
