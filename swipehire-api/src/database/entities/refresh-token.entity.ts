import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from './user.entity';

/**
 * A live refresh token, stored as a hash so the table is useless to anyone who dumps it.
 *
 * `revokedAt` rather than a delete: a revoked row is what lets a later reuse attempt be recognised
 * as such instead of looking like an unknown token. The demo doesn't act on that distinction
 * (Security Baseline §1 defers reuse-detection), but throwing the evidence away now would mean
 * re-designing the table to add it back.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_refresh_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /** SHA-256 of the token. The raw value exists only in the response to the client. */
  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  isUsable(now: Date = new Date()): boolean {
    return this.revokedAt === null && this.expiresAt > now;
  }
}
