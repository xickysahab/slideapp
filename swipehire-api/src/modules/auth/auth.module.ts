import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: users, refresh_tokens
 * Built in:    DEMO-03
 *
 * Exports AuthService so other modules can resolve a user without reaching into `users` directly.
 * That boundary is what keeps a later service extraction mechanical rather than a rewrite.
 *
 * JwtModule is registered without a secret on purpose: access and refresh tokens are signed with
 * *different* secrets (Demo Architecture §7), so each call passes its own. A module-level default
 * would be the easy thing to accidentally rely on, and signing a refresh token with the access
 * secret would quietly make a stolen access token exchangeable for a 30-day session.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken]), PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
