import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Owned by ProfileModule (the demo folds the full spec's separate CompanyModule into it — a
 * company is the recruiter's profile).
 *
 * `verified` defaults to true: the demo auto-verifies every recruiter (Demo PRD §2 rows 4 and 20).
 * The badge still renders, so the trust signal is visible; there is simply no workflow behind it.
 */
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  industry!: string | null;

  @Column({ type: 'boolean', default: true })
  verified!: boolean;
}
