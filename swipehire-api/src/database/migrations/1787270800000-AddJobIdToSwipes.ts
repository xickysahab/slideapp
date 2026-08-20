import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scopes a recruiter's swipe to the listing it was made for.
 *
 * Demo Architecture §3 defines swipes as UNIQUE (actor_id, target_id, target_type) with no job
 * column. The full spec's version of the same table (Architecture §4, line 409) carries
 * `job_id`, "populated when target_type='candidate'", and keys uniqueness on it. Dropping it isn't
 * a trim — it changes behaviour, in two ways that both bite:
 *
 *   1. A recruiter who passes on a candidate for one listing loses that candidate from every other
 *      listing's deck too, permanently and silently.
 *   2. Match detection can't tell which job a recruiter's right-swipe was for — while `matches` is
 *      keyed UNIQUE (candidate_id, job_id), per job. The two tables disagree about what a swipe
 *      means.
 *
 * The demo docs get away with this because Demo PRD §3 has each recruiter create exactly one
 * listing. The recruiter dashboard is explicitly multi-job, so the assumption no longer holds.
 *
 * ── On the unique constraints ──
 *
 * The full spec uses a single UNIQUE (swiper_id, target_type, target_id, job_id). That has a hole:
 * in Postgres, NULLs are never equal to each other, so rows with a NULL job_id — every
 * candidate→job swipe — are never seen as duplicates and the constraint silently stops protecting
 * exactly the swipe direction the candidate deck generates.
 *
 * Two partial unique indexes instead, one for each shape. Demo Architecture §4 calls the swipe
 * unique constraint a correctness property rather than a scale optimisation, and a constraint that
 * quietly covers only half the rows is worse than none, because it looks like it's working.
 */
export class AddJobIdToSwipes1787270800000 implements MigrationInterface {
  name = 'AddJobIdToSwipes1787270800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE swipes ADD COLUMN job_id UUID REFERENCES jobs(id) ON DELETE CASCADE`,
    );

    await queryRunner.query(`ALTER TABLE swipes DROP CONSTRAINT swipes_actor_id_target_id_target_type_key`);

    // Candidate → job. One swipe per candidate per job; job_id is null on these rows.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_swipe_no_job
        ON swipes (actor_id, target_type, target_id)
        WHERE job_id IS NULL
    `);

    // Recruiter → candidate. The same candidate may be swiped once per listing.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_swipe_per_job
        ON swipes (actor_id, target_type, target_id, job_id)
        WHERE job_id IS NOT NULL
    `);

    // Deck building asks "what has this actor already seen, for this job" on every fetch.
    await queryRunner.query(`CREATE INDEX idx_swipes_actor_job ON swipes (actor_id, target_type, job_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_swipes_actor_job`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_swipe_per_job`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_swipe_no_job`);
    await queryRunner.query(`ALTER TABLE swipes DROP COLUMN IF EXISTS job_id`);
    await queryRunner.query(
      `ALTER TABLE swipes ADD CONSTRAINT swipes_actor_id_target_id_target_type_key UNIQUE (actor_id, target_id, target_type)`,
    );
  }
}
