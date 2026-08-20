import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';

/**
 * ResumeModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: none of its own — it writes the resume key and extracted skills onto
 *              candidate_profiles, which ProfileModule owns.
 * Built in:    DEMO-05
 *
 * The full spec runs this as a separate Python service with a deterministic pipeline and an LLM
 * fallback. The demo folds it in here as pdf-parse plus a keyword taxonomy (Architecture §1, §6):
 * one deployable, no second runtime, and accurate enough precisely because the seed resumes are
 * ones you picked.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CandidateProfile])],
  controllers: [ResumeController],
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}
