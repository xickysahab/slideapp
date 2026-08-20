import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DEMO-16b — the one column added beyond Demo Architecture §3.
 *
 * Kept as its own migration rather than folded into the initial schema so the deviation stays
 * visible in the history: §3 is reproduced verbatim by the previous migration, and everything this
 * build adds on top is auditable here.
 *
 * Background: the client's user-journey diagram ends with Outcome → Hired / Not Selected, which the
 * demo docs never covered. That tail was agreed back into scope (see
 * docs/SwipeHire-DEMO-Journey-Map.md §3). Everything it needs already exists —
 * `matches.status` carries `active | archived | closed` and `jobs.status` carries
 * `active | filled` — except the optional recruiter feedback note shown to a candidate who wasn't
 * selected.
 */
export class AddMatchOutcomeNote1787270500000 implements MigrationInterface {
  name = 'AddMatchOutcomeNote1787270500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable by design: the diagram calls the feedback prompt "optional", so declining to write
    // one is a first-class path, not a missing value.
    await queryRunner.query(`ALTER TABLE matches ADD COLUMN outcome_note TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE matches DROP COLUMN IF EXISTS outcome_note`);
  }
}
