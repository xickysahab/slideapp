import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Match } from './match.entity';
import { User } from './user.entity';

export interface InterviewSlot {
  /** ISO 8601 with offset. */
  start: string;
  end: string;
  /** IANA zone, e.g. Asia/Kolkata. Stored so a slot reads correctly on both sides. */
  timezone: string;
}

/** proposed → confirmed. One round, no reject/re-propose history (Demo PRD §2 row 18). */
export type InterviewStatus = 'proposed' | 'confirmed';

/**
 * Owned by InterviewModule (Demo Architecture §2).
 *
 * The full spec's calendar columns (calendar_event_id and friends) are not created — calendar sync
 * is cut for the demo. The table is otherwise shaped the same, so adding them later is additive.
 */
@Entity('interviews')
export class Interview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match!: Match;

  @Column({ name: 'proposed_by', type: 'uuid' })
  proposedBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'proposed_by' })
  proposer!: User;

  @Column({ name: 'proposed_slots', type: 'jsonb' })
  proposedSlots!: InterviewSlot[];

  @Column({ name: 'confirmed_slot', type: 'jsonb', nullable: true })
  confirmedSlot!: InterviewSlot | null;

  @Column({ type: 'text', default: 'proposed' })
  status!: InterviewStatus;
}
