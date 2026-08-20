import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { RefreshToken } from './refresh-token.entity';

export type UserRole = 'candidate' | 'recruiter';

/**
 * Owned by AuthModule (Demo Architecture §2). Other modules read a user through AuthService rather
 * than querying this table directly, so extracting auth into its own service later stays mechanical.
 *
 * These entity definitions describe a schema that already exists — the migrations are the source of
 * truth, not the other way round. `synchronize` is off precisely so a drift here can never silently
 * rewrite the database.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * CITEXT, so uniqueness is case-insensitive at the database level — `Aagam@x.com` and
   * `aagam@x.com` cannot both exist. Lower-casing in application code would leave the guarantee
   * dependent on every future write path remembering to do it.
   */
  @Column({ type: 'citext', unique: true })
  email!: string;

  /** Null for accounts created through Google OAuth, which never had a password to hash. */
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'enum', enum: ['candidate', 'recruiter'], enumName: 'user_role' })
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens!: RefreshToken[];
}
