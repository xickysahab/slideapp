import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { User } from './user.entity';

/** Fields common to both roles. Owned by ProfileModule (Demo Architecture §2). */
@Entity('profiles')
export class Profile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'location_city', type: 'text', nullable: true })
  locationCity!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
