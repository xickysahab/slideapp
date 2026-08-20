import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import { Job } from '../../database/entities/job.entity';
import { Match } from '../../database/entities/match.entity';
import { Message } from '../../database/entities/message.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Swipe } from '../../database/entities/swipe.entity';
import { MatchService } from './match.service';
import { SwipeMatchController } from './swipe-match.controller';
import { SwipeService } from './swipe.service';

/**
 * SwipeMatchModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: swipes, matches
 * Built in:    swipe recording, match derivation, the matches list, and the outcome tail
 *
 * It reads Job, CandidateProfile, Profile and Message rows to score a match and summarise a thread.
 * Those belong to other modules; the pragmatic line drawn here is that this module reads them but
 * never writes them, except for the one job status change the Hired outcome requires.
 *
 * Exports SwipeService so the discovery feed can filter out already-swiped targets, and
 * MatchService so ChatModule and InterviewModule can reuse its participant check rather than each
 * inventing their own.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Swipe, Match, Job, CandidateProfile, Profile, Message])],
  controllers: [SwipeMatchController],
  providers: [SwipeService, MatchService],
  exports: [SwipeService, MatchService],
})
export class SwipeMatchModule {}
