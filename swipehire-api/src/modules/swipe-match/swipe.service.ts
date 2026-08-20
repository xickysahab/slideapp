import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import { Job } from '../../database/entities/job.entity';
import { Match } from '../../database/entities/match.entity';
import { Swipe, type SwipeTargetType } from '../../database/entities/swipe.entity';
import type { UserRole } from '../../database/entities/user.entity';
import { computeMatch } from '../../shared/matching/match-score';
import { RealtimeGateway } from '../../shared/realtime/realtime.gateway';
import type { RecordSwipeDto } from './dto/swipe.dto';

export interface SwipeResult {
  recorded: true;
  matched: boolean;
  matchId?: string;
}

@Injectable()
export class SwipeService {
  private readonly logger = new Logger(SwipeService.name);

  constructor(
    @InjectRepository(Swipe) private readonly swipes: Repository<Swipe>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(CandidateProfile) private readonly candidates: Repository<CandidateProfile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Records one swipe and, if it completes a mutual right-swipe, creates the match.
   *
   * The shape of this is Demo Architecture §4: write the swipe, and only for a right swipe, check
   * whether the other side already swiped right. Left swipes never touch the match check at all —
   * they're a pure "don't show again" signal, silent and permanent, which Demo PRD §5 makes
   * load-bearing for the trust model rather than a missing feature.
   *
   * There is no endpoint anywhere that accepts a match from a client. A match only ever exists as
   * a server-derived consequence of two independent, authenticated swipes (Security Baseline §1).
   */
  async recordSwipe(actorId: string, role: UserRole, dto: RecordSwipeDto): Promise<SwipeResult> {
    const context = await this.resolveContext(actorId, role, dto);

    await this.upsertSwipe({
      actorId,
      targetId: dto.targetId,
      targetType: dto.targetType,
      direction: dto.direction,
      jobId: context.swipeJobId,
    });

    if (dto.direction === 'left') return { recorded: true, matched: false };

    const reciprocated = await this.hasReciprocalRightSwipe(context);
    if (!reciprocated) return { recorded: true, matched: false };

    const match = await this.createMatch(context);
    return { recorded: true, matched: true, matchId: match.id };
  }

  /**
   * Target ids this actor has already swiped on, in either direction.
   *
   * Both directions, because a left swipe is permanent — a passed card must never resurface.
   * `jobId` scopes recruiter swipes to one listing; pass null for candidate→job swipes.
   */
  async getSwipedTargetIds(
    actorId: string,
    targetType: SwipeTargetType,
    jobId: string | null,
  ): Promise<string[]> {
    const rows = await this.swipes.find({
      where: { actorId, targetType, jobId: jobId === null ? IsNull() : jobId },
      select: { targetId: true },
    });

    return rows.map((row) => row.targetId);
  }

  /**
   * Works out who is swiping on whom, for which job, and rejects anything that doesn't make sense.
   *
   * The two directions are genuinely different shapes: a candidate swipes on a job (and the job
   * identifies everything else), while a recruiter swipes on a candidate *for one of their
   * listings*, which is why the swipe needs an explicit job.
   */
  private async resolveContext(actorId: string, role: UserRole, dto: RecordSwipeDto) {
    if (role === 'candidate') {
      if (dto.targetType !== 'job') {
        throw new BadRequestException('Candidates swipe on jobs');
      }
      if (dto.jobId) {
        // The target already is the job; a second job id could only disagree with it.
        throw new BadRequestException('jobId is not used when swiping on a job');
      }

      const job = await this.jobs.findOne({ where: { id: dto.targetId, status: 'active' } });
      if (!job) throw new NotFoundException('Job not found');

      return {
        candidateId: actorId,
        recruiterId: job.recruiterId,
        job,
        swipeJobId: null as string | null,
      };
    }

    if (dto.targetType !== 'candidate') {
      throw new BadRequestException('Recruiters swipe on candidates');
    }
    if (!dto.jobId) {
      throw new BadRequestException('jobId is required when swiping on a candidate');
    }

    const job = await this.jobs.findOne({ where: { id: dto.jobId } });
    // Ownership, and 404 rather than 403 so an unowned job is indistinguishable from a missing one.
    if (!job || job.recruiterId !== actorId) throw new NotFoundException('Job not found');
    if (job.status !== 'active') throw new BadRequestException('That listing is no longer open');

    const candidate = await this.candidates.findOne({ where: { userId: dto.targetId } });
    if (!candidate) throw new NotFoundException('Candidate not found');

    return {
      candidateId: dto.targetId,
      recruiterId: actorId,
      job,
      swipeJobId: job.id as string | null,
    };
  }

  /**
   * Insert, or update the direction if this pair has been swiped before.
   *
   * Raw SQL because the uniqueness is enforced by two *partial* indexes (see the AddJobIdToSwipes
   * migration), and `ON CONFLICT` has to name the same predicate to use one. TypeORM's `upsert`
   * can't express that.
   *
   * The upsert is also what makes the write idempotent, so a client retrying after a dropped
   * response can't create a duplicate.
   */
  private async upsertSwipe(row: {
    actorId: string;
    targetId: string;
    targetType: SwipeTargetType;
    direction: 'left' | 'right';
    jobId: string | null;
  }): Promise<void> {
    const conflict =
      row.jobId === null
        ? '(actor_id, target_type, target_id) WHERE job_id IS NULL'
        : '(actor_id, target_type, target_id, job_id) WHERE job_id IS NOT NULL';

    await this.swipes.query(
      `INSERT INTO swipes (actor_id, target_id, target_type, direction, job_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ${conflict}
       DO UPDATE SET direction = EXCLUDED.direction`,
      [row.actorId, row.targetId, row.targetType, row.direction, row.jobId],
    );
  }

  /** Did the other party already swipe right on this exact pairing? */
  private async hasReciprocalRightSwipe(ctx: {
    candidateId: string;
    recruiterId: string;
    job: Job;
  }): Promise<boolean> {
    const [recruiterSide, candidateSide] = await Promise.all([
      this.swipes.findOne({
        where: {
          actorId: ctx.recruiterId,
          targetType: 'candidate',
          targetId: ctx.candidateId,
          jobId: ctx.job.id,
          direction: 'right',
        },
      }),
      this.swipes.findOne({
        where: {
          actorId: ctx.candidateId,
          targetType: 'job',
          targetId: ctx.job.id,
          jobId: IsNull(),
          direction: 'right',
        },
      }),
    ]);

    return Boolean(recruiterSide && candidateSide);
  }

  /**
   * Creates the match, exactly once.
   *
   * `ON CONFLICT DO NOTHING` on the (candidate_id, job_id) unique constraint is the whole
   * concurrency story: if both sides swipe right at the same instant and two requests race here,
   * the database decides, and the loser reads back the winner's row. Architecture §4 uses a Redis
   * lock for this at scale; the constraint underneath it is what actually guarantees correctness,
   * and it's the part that survives into the demo.
   *
   * Synchronous and inside a transaction, because a match is too significant an event to risk to a
   * batch flush — the one place §4 allows a synchronous Postgres write.
   */
  private async createMatch(ctx: {
    candidateId: string;
    recruiterId: string;
    job: Job;
  }): Promise<Match> {
    const candidate = await this.candidates.findOne({ where: { userId: ctx.candidateId } });

    const { score } = computeMatch({
      candidateSkills: candidate?.skills ?? [],
      jobTechStack: ctx.job.techStack,
      candidateYears: candidate?.yearsExperience ?? null,
      jobMinYears: ctx.job.experienceMinYears,
    });

    const match = await this.dataSource.transaction(async (tx) => {
      const inserted: { id: string }[] = await tx.query(
        `INSERT INTO matches (candidate_id, recruiter_id, job_id, match_score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (candidate_id, job_id) DO NOTHING
         RETURNING id`,
        [ctx.candidateId, ctx.recruiterId, ctx.job.id, score],
      );

      const id =
        inserted[0]?.id ??
        (
          await tx.query<{ id: string }[]>(
            `SELECT id FROM matches WHERE candidate_id = $1 AND job_id = $2`,
            [ctx.candidateId, ctx.job.id],
          )
        )[0]?.id;

      return tx.getRepository(Match).findOneOrFail({
        where: { id },
        relations: { job: { company: true } },
      });
    });

    /**
     * Downstream of the match, and deliberately after the transaction commits: the notification is
     * a consequence of the match existing, not a participant in creating it. A socket failure must
     * not roll back a match that both parties have already earned.
     */
    this.realtime.emitToUsers([ctx.candidateId, ctx.recruiterId], 'match:created', {
      matchId: match.id,
      jobId: ctx.job.id,
      jobTitle: ctx.job.title,
      companyName: match.job?.company?.name ?? null,
      matchScore: match.matchScore,
      matchedAt: match.matchedAt,
    });

    this.logger.log(`match ${match.id}: candidate ${ctx.candidateId} × job ${ctx.job.id}`);
    return match;
  }
}
