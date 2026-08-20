import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Job } from './job.entity';
import { User } from './user.entity';

/**
 * Demo lifecycle:
 *   active   — matched, chatting
 *   archived — the Hired outcome
 *   closed   — the Not Selected outcome
 *
 * See the Journey Map for why the outcome states exist at all: the client's journey diagram ends
 * at Hired / Not Selected, which the demo docs never covered.
 */
export type MatchStatus = 'active' | 'archived' | 'closed';

/** Owned by SwipeMatchModule (Demo Architecture §2). */
@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'candidate_id' })
  candidate!: User;

  @Column({ name: 'recruiter_id', type: 'uuid' })
  recruiterId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recruiter_id' })
  recruiter!: User;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job!: Job;

  /**
   * Snapshotted at match time rather than recomputed on read. If the candidate later edits their
   * skills, the score attached to this match shouldn't silently drift away from the number both
   * parties saw when they matched.
   */
  @Column({ name: 'match_score', type: 'smallint', nullable: true })
  matchScore!: number | null;

  @Column({ type: 'text', default: 'active' })
  status!: MatchStatus;

  /** Optional recruiter note shown to a candidate who wasn't selected. */
  @Column({ name: 'outcome_note', type: 'text', nullable: true })
  outcomeNote!: string | null;

  @CreateDateColumn({ name: 'matched_at', type: 'timestamptz' })
  matchedAt!: Date;
}
