import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';

import { Company } from './company.entity';
import { User } from './user.entity';

/**
 * Joins a recruiter to their company. See the AddRecruiterProfiles migration for why this exists
 * when Demo Architecture §3 doesn't list it.
 */
@Entity('recruiter_profiles')
export class RecruiterProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
