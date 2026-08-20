import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import { Company } from '../../database/entities/company.entity';
import { Profile } from '../../database/entities/profile.entity';
import { RecruiterProfile } from '../../database/entities/recruiter-profile.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

/**
 * ProfileModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: profiles, candidate_profiles, companies, recruiter_profiles
 * Built in:    DEMO-04 (resume fields land in DEMO-05)
 *
 * The demo folds the full spec's separate CompanyModule in here: a company is effectively the
 * recruiter's profile, and splitting it would mean two modules for one onboarding flow.
 *
 * Exports ProfileService so JobModule can resolve a recruiter's company and the discovery feed can
 * read candidate profiles, without either reaching into these tables directly.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Profile, CandidateProfile, Company, RecruiterProfile])],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
