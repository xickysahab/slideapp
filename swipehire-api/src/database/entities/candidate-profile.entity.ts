import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { User } from './user.entity';

export type WorkMode = 'remote' | 'hybrid' | 'onsite';

/**
 * Candidate-side profile. Owned by ProfileModule.
 *
 * `skills` is a plain TEXT[] rather than the full spec's candidate_skills junction table — that
 * table is among the ones Demo Architecture §3 drops. Fine at demo scale, where nothing needs to
 * query "who has skill X" across a large population.
 *
 * `resumeEmbedding` is never populated in this build: embeddings (DEMO-05b) are out of scope and
 * match scoring uses the skills/experience fallback. The column exists so turning them on later is
 * a config change, not a migration.
 */
@Entity('candidate_profiles')
export class CandidateProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text', nullable: true })
  headline!: string | null;

  @Column({ name: 'current_title', type: 'text', nullable: true })
  currentTitle!: string | null;

  @Column({ name: 'years_experience', type: 'smallint', nullable: true })
  yearsExperience!: number | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  skills!: string[];

  @Column({ name: 'resume_s3_key', type: 'text', nullable: true })
  resumeS3Key!: string | null;

  @Column({ name: 'expected_salary_min', type: 'int', nullable: true })
  expectedSalaryMin!: number | null;

  @Column({ name: 'expected_salary_max', type: 'int', nullable: true })
  expectedSalaryMax!: number | null;

  @Column({ name: 'preferred_work_mode', type: 'enum', enum: ['remote', 'hybrid', 'onsite'], enumName: 'work_mode', nullable: true })
  preferredWorkMode!: WorkMode | null;

  @Column({ name: 'notice_period_days', type: 'smallint', nullable: true })
  noticePeriodDays!: number | null;
}
