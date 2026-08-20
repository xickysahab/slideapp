import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Company } from './company.entity';
import { User } from './user.entity';

export type WorkMode = 'remote' | 'hybrid' | 'onsite';
/** Demo lifecycle. 'filled' is set by the Hired outcome (see the Journey Map, DEMO-16b). */
export type JobStatus = 'active' | 'filled';

/** Owned by JobModule (Demo Architecture §2). */
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  /**
   * The recruiter who posted it. This column is the ownership check for every write — the demo is
   * explicitly one recruiter per listing (Demo PRD §6 rules out collaborative hiring).
   */
  @Column({ name: 'recruiter_id', type: 'uuid' })
  recruiterId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recruiter_id' })
  recruiter!: User;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'tech_stack', type: 'text', array: true, default: () => "'{}'" })
  techStack!: string[];

  /** Annual, in rupees. Null means undisclosed — the card says so rather than hiding the row. */
  @Column({ name: 'comp_min', type: 'int', nullable: true })
  compMin!: number | null;

  @Column({ name: 'comp_max', type: 'int', nullable: true })
  compMax!: number | null;

  @Column({ name: 'location_city', type: 'text', nullable: true })
  locationCity!: string | null;

  @Column({ name: 'work_mode', type: 'enum', enum: ['remote', 'hybrid', 'onsite'], enumName: 'work_mode', nullable: true })
  workMode!: WorkMode | null;

  @Column({ name: 'experience_min_years', type: 'smallint', nullable: true })
  experienceMinYears!: number | null;

  @Column({ type: 'text', default: 'active' })
  status!: JobStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
