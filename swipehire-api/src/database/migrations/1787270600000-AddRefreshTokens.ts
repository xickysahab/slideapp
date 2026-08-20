import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DEMO-03 — server-side refresh token storage.
 *
 * The second addition beyond Demo Architecture §3, kept as its own migration for the same reason as
 * DEMO-16b's outcome_note: what this build adds on top of the spec should be visible in history.
 *
 * Why it's needed: Demo Security Baseline §1 requires the refresh token to be "stored server-side",
 * but §3's schema has no table for it — the full spec's `sessions` table is explicitly among those
 * not created for the demo. Storing it somewhere is the only way to make logout actually revoke
 * anything rather than just deleting the token from the client and hoping.
 *
 * A column on `users` would have been smaller, but it caps a user at one live session. During the
 * demo the same account may well be open on a simulator and a phone at once, and having the second
 * login silently kill the first is exactly the kind of thing that derails a live walkthrough.
 *
 * Only the token's SHA-256 hash is stored. A dump of this table then yields no usable sessions —
 * the same reason password_hash exists rather than password.
 */
export class AddRefreshTokens1787270600000 implements MigrationInterface {
  name = 'AddRefreshTokens1787270600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash   TEXT NOT NULL UNIQUE,
          expires_at   TIMESTAMPTZ NOT NULL,
          revoked_at   TIMESTAMPTZ,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Every refresh and every logout looks tokens up by user; without this they're seq scans.
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
  }
}
