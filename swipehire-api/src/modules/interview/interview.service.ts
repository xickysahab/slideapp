import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Interview, type InterviewSlot } from '../../database/entities/interview.entity';
import type { UserRole } from '../../database/entities/user.entity';
import { RealtimeGateway } from '../../shared/realtime/realtime.gateway';
import { MatchService } from '../swipe-match/match.service';

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(Interview) private readonly interviews: Repository<Interview>,
    private readonly matchService: MatchService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** The interview attached to a match, if any. Either participant may read it. */
  async findForMatch(matchId: string, userId: string): Promise<Interview | null> {
    await this.matchService.findForParticipant(matchId, userId);
    return this.interviews.findOne({ where: { matchId } });
  }

  /**
   * Recruiter proposes times inside the chat thread.
   *
   * One round only (Demo PRD §2 row 18): a proposal that already exists can be replaced while it's
   * still pending, but once a slot is confirmed the round is over. Reject-and-re-propose history is
   * explicitly out of scope, so there's no state for it to live in.
   */
  async propose(
    matchId: string,
    userId: string,
    role: UserRole,
    slots: InterviewSlot[],
  ): Promise<Interview> {
    const match = await this.matchService.findForParticipant(matchId, userId);

    if (role !== 'recruiter' || match.recruiterId !== userId) {
      throw new NotFoundException('Match not found');
    }
    if (match.status !== 'active') {
      throw new BadRequestException('This conversation has been closed');
    }

    this.assertSlotsSane(slots);

    const existing = await this.interviews.findOne({ where: { matchId } });
    if (existing?.status === 'confirmed') {
      throw new ConflictException('An interview is already confirmed for this match');
    }

    const interview = await this.interviews.save(
      this.interviews.create({
        ...(existing ?? {}),
        matchId,
        proposedBy: userId,
        proposedSlots: slots,
        confirmedSlot: null,
        status: 'proposed',
      }),
    );

    // The candidate's chat thread renders the slot card without a refresh.
    this.realtime.emitToUsers([match.candidateId, match.recruiterId], 'interview:proposed', {
      matchId,
      interviewId: interview.id,
      proposedSlots: interview.proposedSlots,
    });

    return interview;
  }

  /**
   * Candidate picks one of the offered times.
   *
   * Takes an index into the stored proposal rather than a slot object from the request. If the
   * client sent the slot itself, it could confirm a time that was never offered — the server would
   * have nothing to check it against.
   */
  async accept(matchId: string, userId: string, role: UserRole, slotIndex: number): Promise<Interview> {
    const match = await this.matchService.findForParticipant(matchId, userId);

    if (role !== 'candidate' || match.candidateId !== userId) {
      throw new NotFoundException('Match not found');
    }

    const interview = await this.interviews.findOne({ where: { matchId } });
    if (!interview) throw new NotFoundException('No interview has been proposed yet');

    if (interview.status === 'confirmed') {
      throw new ConflictException('This interview is already confirmed');
    }

    const slot = interview.proposedSlots[slotIndex];
    if (!slot) throw new BadRequestException('That slot was not one of the options');

    interview.confirmedSlot = slot;
    interview.status = 'confirmed';
    const saved = await this.interviews.save(interview);

    this.realtime.emitToUsers([match.candidateId, match.recruiterId], 'interview:confirmed', {
      matchId,
      interviewId: saved.id,
      confirmedSlot: saved.confirmedSlot,
    });

    return saved;
  }

  /**
   * Rejects proposals that would render as nonsense in the chat thread.
   *
   * Not a policy engine — just the three things that would visibly embarrass a live demo: a slot
   * that ends before it starts, one scheduled in the past, and duplicates of the same time.
   */
  private assertSlotsSane(slots: InterviewSlot[]): void {
    const now = Date.now();
    const seen = new Set<string>();

    for (const slot of slots) {
      const start = new Date(slot.start).getTime();
      const end = new Date(slot.end).getTime();

      if (Number.isNaN(start) || Number.isNaN(end)) {
        throw new BadRequestException('Slot times must be valid dates');
      }
      if (end <= start) {
        throw new BadRequestException('A slot must end after it starts');
      }
      if (start < now) {
        throw new BadRequestException('Slots must be in the future');
      }
      if (seen.has(slot.start)) {
        throw new BadRequestException('Slots must be distinct');
      }
      seen.add(slot.start);
    }
  }
}
