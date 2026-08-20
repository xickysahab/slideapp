import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DEMO-01 — the demo schema, transcribed from docs/SwipeHire-DEMO-Architecture.md §3.
 *
 * The DDL below is copied from that document rather than generated from entity classes, because
 * §3 *is* the specification: every table maps 1:1 onto a table in the full architecture doc, so
 * growing toward the real schema later is additive rather than a rewrite.
 *
 * ONE ADDITION to what §3 literally says: `CREATE EXTENSION citext`. §3 declares
 * `users.email CITEXT` but only creates the `vector` and `pgcrypto` extensions — running it
 * verbatim fails with "type citext does not exist". This is a gap in the doc, not a scope change;
 * the alternative (downgrading email to TEXT) would silently lose the case-insensitive uniqueness
 * that stops `Aagam@x.com` and `aagam@x.com` registering as two accounts.
 *
 * The two HNSW indexes are created even though the embeddings ticket (DEMO-05b) is out of scope.
 * They are free on empty columns and keep the semantic-similarity factor a config change later
 * rather than another migration.
 */
export class InitialSchema1787270400000 implements MigrationInterface {
  name = 'InitialSchema1787270400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    // See header note — required by users.email, omitted from §3.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await queryRunner.query(`CREATE TYPE user_role AS ENUM ('candidate', 'recruiter')`);

    await queryRunner.query(`
      CREATE TABLE users (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email           CITEXT UNIQUE NOT NULL,
          password_hash   TEXT,
          role            user_role NOT NULL,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE profiles (
          user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          full_name       TEXT NOT NULL,
          avatar_url      TEXT,
          location_city   TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE TYPE work_mode AS ENUM ('remote', 'hybrid', 'onsite')`);

    await queryRunner.query(`
      CREATE TABLE candidate_profiles (
          user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          headline              TEXT,
          current_title         TEXT,
          years_experience      SMALLINT,
          skills                TEXT[] DEFAULT '{}',
          resume_s3_key         TEXT,
          resume_embedding      VECTOR(768),
          expected_salary_min   INTEGER,
          expected_salary_max   INTEGER,
          preferred_work_mode   work_mode,
          notice_period_days    SMALLINT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE companies (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name        TEXT NOT NULL,
          logo_url    TEXT,
          industry    TEXT,
          verified    BOOLEAN NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE TABLE jobs (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id           UUID NOT NULL REFERENCES companies(id),
          recruiter_id         UUID NOT NULL REFERENCES users(id),
          title                TEXT NOT NULL,
          description          TEXT,
          tech_stack           TEXT[] DEFAULT '{}',
          comp_min             INTEGER,
          comp_max             INTEGER,
          location_city        TEXT,
          work_mode            work_mode,
          experience_min_years SMALLINT,
          embedding            VECTOR(768),
          status               TEXT NOT NULL DEFAULT 'active',
          created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    /**
     * BIGSERIAL rather than UUID here and on `messages` is deliberate and narrow — these are the
     * two highest-write-frequency tables, and the full architecture doc (ADR #12) takes the
     * insert-performance win. `target_id` is intentionally polymorphic with no FK: integrity is
     * enforced in the application layer instead (ADR #3).
     *
     * The UNIQUE constraint is the real dedup guarantee. Demo Architecture §4 is explicit that this
     * is a correctness property, not a scale optimisation — it must not be dropped.
     */
    await queryRunner.query(`
      CREATE TABLE swipes (
          id           BIGSERIAL PRIMARY KEY,
          actor_id     UUID NOT NULL REFERENCES users(id),
          target_id    UUID NOT NULL,
          target_type  TEXT NOT NULL CHECK (target_type IN ('candidate', 'job')),
          direction    TEXT NOT NULL CHECK (direction IN ('left', 'right')),
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (actor_id, target_id, target_type)
      )
    `);

    /** UNIQUE (candidate_id, job_id) is what makes match creation exactly-once. Do not remove. */
    await queryRunner.query(`
      CREATE TABLE matches (
          id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          candidate_id   UUID NOT NULL REFERENCES users(id),
          recruiter_id   UUID NOT NULL REFERENCES users(id),
          job_id         UUID NOT NULL REFERENCES jobs(id),
          match_score    SMALLINT,
          status         TEXT NOT NULL DEFAULT 'active',
          matched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (candidate_id, job_id)
      )
    `);

    /** No `conversations` table by design — a match *is* the thread (Architecture §4.1). */
    await queryRunner.query(`
      CREATE TABLE messages (
          id          BIGSERIAL PRIMARY KEY,
          match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          sender_id   UUID NOT NULL REFERENCES users(id),
          content     TEXT NOT NULL,
          sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          read_at     TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE interviews (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          match_id         UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          proposed_by      UUID NOT NULL REFERENCES users(id),
          proposed_slots   JSONB NOT NULL,
          confirmed_slot   JSONB,
          status           TEXT NOT NULL DEFAULT 'proposed'
      )
    `);

    await queryRunner.query(
      `CREATE INDEX ON candidate_profiles USING hnsw (resume_embedding vector_cosine_ops)`,
    );
    await queryRunner.query(`CREATE INDEX ON jobs USING hnsw (embedding vector_cosine_ops)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse dependency order. Extensions are left in place — dropping `vector` or `pgcrypto`
    // would affect anything else in the database that happens to use them.
    await queryRunner.query(`DROP TABLE IF EXISTS interviews`);
    await queryRunner.query(`DROP TABLE IF EXISTS messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS matches`);
    await queryRunner.query(`DROP TABLE IF EXISTS swipes`);
    await queryRunner.query(`DROP TABLE IF EXISTS jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS companies`);
    await queryRunner.query(`DROP TABLE IF EXISTS candidate_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TYPE IF EXISTS work_mode`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role`);
  }
}
