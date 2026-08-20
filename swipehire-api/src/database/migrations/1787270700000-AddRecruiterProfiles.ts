import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DEMO-04 — links a recruiter to their company.
 *
 * Demo Architecture §3 keeps `companies` but drops the full spec's `recruiter_profiles`, which
 * leaves nothing joining a recruiter to a company. That breaks the recruiter journey in Demo PRD
 * §3 — "sign up → company profile → create one job listing" — because the company exists before
 * any job does, so `jobs.company_id` can't be the link. Without this, a recruiter who has set up a
 * company and not yet posted a job is unreachable from their own account.
 *
 * Shaped after the full spec's own `recruiter_profiles` (Architecture §4, line 309) rather than a
 * bare `owner_user_id` column on `companies`, so growing into the real schema stays additive —
 * that's the property Demo Architecture §3 is explicitly trying to preserve. Trimmed to the two
 * columns the demo actually uses; the full spec's job_title, department and is_verified are not
 * created.
 *
 * Keyed on user_id, matching how `profiles` and `candidate_profiles` are keyed in §3. One row per
 * recruiter: the demo is explicitly single-recruiter-per-company (Demo PRD §6 rules out
 * multi-recruiter company accounts).
 */
export class AddRecruiterProfiles1787270700000 implements MigrationInterface {
  name = 'AddRecruiterProfiles1787270700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruiter_profiles (
          user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_recruiter_profiles_company ON recruiter_profiles (company_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS recruiter_profiles`);
  }
}
