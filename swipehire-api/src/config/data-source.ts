import 'dotenv/config';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';

/**
 * TypeORM connection config, shared by the running app and the migration CLI.
 *
 * `synchronize` is false and must stay false. Auto-sync silently rewrites the schema to match
 * whatever the entity files currently say, which would quietly undo the hand-written DDL copied
 * verbatim from Demo Architecture §3 — the schema is the spec here, not a derived artifact.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,

  // Supabase terminates TLS with a certificate chain Node doesn't ship a root for. Verification is
  // relaxed rather than the connection being left unencrypted — the traffic is still TLS.
  // Production (full spec) pins the CA properly; that's a pre-launch item, not a demo one.
  ssl: { rejectUnauthorized: false },

  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],

  // Glob covers both `.ts` under ts-node and `.js` after a build.
  entities: [join(__dirname, '..', 'database', 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
};

/**
 * The TypeORM CLI requires this file to export exactly one DataSource instance, so this is a bare
 * default export — adding a named alias for the same object makes the CLI refuse to load it.
 * Application code imports `dataSourceOptions` above and lets Nest own the connection lifecycle.
 */
export default new DataSource(dataSourceOptions);
