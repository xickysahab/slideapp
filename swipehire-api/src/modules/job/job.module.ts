import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import { Job } from '../../database/entities/job.entity';
import { Profile } from '../../database/entities/profile.entity';
import { ProfileModule } from '../profile/profile.module';
import { SwipeMatchModule } from '../swipe-match/swipe-match.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { JobController } from './job.controller';
import { JobService } from './job.service';

/**
 * JobModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: jobs
 * Built in:    DEMO-06 (discovery and scoring build on this)
 *
 * Imports ProfileModule for its service, not its tables: resolving which company a recruiter posts
 * under goes through ProfileService.getCompanyForRecruiter rather than a join into
 * recruiter_profiles from here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Job, CandidateProfile, Profile]), ProfileModule, SwipeMatchModule],
  controllers: [JobController, DiscoveryController],
  providers: [JobService, DiscoveryService],
  exports: [JobService, DiscoveryService],
})
export class JobModule {}
