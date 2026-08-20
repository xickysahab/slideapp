import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { Job } from '../../database/entities/job.entity';
import { Match, type MatchStatus } from '../../database/entities/match.entity';
import { Message } from '../../database/entities/message.entity';
import { Profile } from '../../database/entities/profile.entity';
import type { UserRole } from '../../database/entities/user.entity';
import { RealtimeGateway } from '../../shared/realtime/realtime.gateway';

export interface MatchSummary {
  id: string;
  status: MatchStatus;
  matchScore: number | null;
  matchedAt: Date;
  job: { id: string; title: string; companyName: string | null };
  /** The person on the other side, named according to the post-match visibility rules. */
  counterparty: { id: string; name: string };
  lastMessage: { content: string; sentAt: Date; fromMe: boolean } | null;
  unreadCount: number;
  outcomeNote: string | null;
}

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Every match the caller is part of, newest first.
   *
   * Scoped by candidate_id OR recruiter_id from the token — there is no way to ask for anyone
   * else's list, and no id in the request to tamper with.
   */
  async listMine(userId: string): Promise<MatchSummary[]> {
    const matches = await this.matches.find({
      where: [{ candidateId: userId }, { recruiterId: userId }],
      relations: { job: { company: true } },
      order: { matchedAt: 'DESC' },
    });

    if (matches.length === 0) return [];

    const summaries = await Promise.all(
      matches.map(async (match) => {
        const counterpartyId = match.candidateId === userId ? match.recruiterId : match.candidateId;

        const [last, unreadCount, name] = await Promise.all([
          this.messages.findOne({ where: { matchId: match.id }, order: { id: 'DESC' } }),
          // IsNull(), not undefined: TypeORM reads undefined as "skip this condition", which would
          // have counted every message from the other party as unread.
          this.messages.count({ where: { matchId: match.id, senderId: counterpartyId, readAt: IsNull() } }),
          this.counterpartyName(counterpartyId),
        ]);

        return {
          id: match.id,
          status: match.status,
          matchScore: match.matchScore,
          matchedAt: match.matchedAt,
          job: {
            id: match.jobId,
            title: match.job?.title ?? '',
            companyName: match.job?.company?.name ?? null,
          },
          counterparty: { id: counterpartyId, name },
          lastMessage: last
            ? { content: last.content, sentAt: last.sentAt, fromMe: last.senderId === userId }
            : null,
          unreadCount,
          outcomeNote: match.outcomeNote,
        };
      }),
    );

    return summaries;
  }

  /**
   * A single match, only for a participant.
   *
   * The participant check is the ownership check that every other match-scoped operation — reading
   * chat history, sending a message, proposing an interview — routes through, so there's one place
   * to be right about it.
   */
  async findForParticipant(matchId: string, userId: string): Promise<Match> {
    const match = await this.matches.findOne({
      where: { id: matchId },
      relations: { job: { company: true } },
    });

    // 404 for a match that exists but isn't yours, so the two cases are indistinguishable
    // (Demo Security Baseline §1).
    if (!match || (match.candidateId !== userId && match.recruiterId !== userId)) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  /**
   * Closes out a match with a hiring decision — the Outcome tail of the client's journey diagram.
   *
   * Recruiter-only: this is a hiring decision, not a mutual one. A candidate calling it gets the
   * same 404 as a stranger.
   */
  async setOutcome(
    matchId: string,
    userId: string,
    role: UserRole,
    outcome: 'hired' | 'not_selected',
    note?: string,
  ): Promise<Match> {
    const match = await this.findForParticipant(matchId, userId);

    if (role !== 'recruiter' || match.recruiterId !== userId) {
      throw new NotFoundException('Match not found');
    }
    if (match.status !== 'active') {
      throw new BadRequestException('This match has already been closed');
    }

    const updated = await this.dataSource.transaction(async (tx) => {
      const matchRepo = tx.getRepository(Match);
      const jobRepo = tx.getRepository(Job);

      if (outcome === 'hired') {
        match.status = 'archived';
        // Hiring someone fills the role: it comes out of every candidate's deck.
        await jobRepo.update({ id: match.jobId }, { status: 'filled' });
      } else {
        match.status = 'closed';
        match.outcomeNote = note?.trim() || null;
      }

      return matchRepo.save(match);
    });

    // Both parties see the state change without refreshing, same pattern as match:created.
    this.realtime.emitToUsers([match.candidateId, match.recruiterId], 'match:outcome', {
      matchId: match.id,
      status: updated.status,
      outcome,
      outcomeNote: updated.outcomeNote,
    });

    return updated;
  }

  /**
   * How the other party is named once a match exists.
   *
   * Post-match the full name is fair game — that's what the match unlocks (Security Baseline §6).
   * Contact details are not: no email or phone travels here even after matching, since the full
   * spec makes contact sharing an explicit, revocable act rather than an automatic consequence.
   */
  private async counterpartyName(userId: string): Promise<string> {
    const profile = await this.profiles.findOne({ where: { userId } });
    return profile?.fullName ?? 'Unknown';
  }
}
