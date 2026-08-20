import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SwipeTargetType = 'job' | 'candidate';
export type SwipeDirection = 'left' | 'right';

/**
 * Owned by SwipeMatchModule (Demo Architecture §2).
 *
 * BIGSERIAL rather than UUID is a deliberate, narrow exception for the two highest-write tables
 * (Architecture §4.1, ADR #12). `targetId` is intentionally polymorphic with no FK — integrity is
 * enforced in the application layer (ADR #3), traded for write-path speed.
 */
@Entity('swipes')
export class Swipe {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  /** A job id when targetType is 'job'; a candidate's user id when it's 'candidate'. */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  @Column({ name: 'target_type', type: 'text' })
  targetType!: SwipeTargetType;

  @Column({ type: 'text' })
  direction!: SwipeDirection;

  /**
   * Which listing a recruiter's swipe was made for. Null for candidate→job swipes, where the
   * target already identifies the job. See the AddJobIdToSwipes migration for why this exists.
   */
  @Column({ name: 'job_id', type: 'uuid', nullable: true })
  jobId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
