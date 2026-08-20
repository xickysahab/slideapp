import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Interview } from '../../database/entities/interview.entity';
import { SwipeMatchModule } from '../swipe-match/swipe-match.module';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';

/**
 * InterviewModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: interviews
 * Built in:    propose → accept, one round
 *
 * Calendar sync is not here and is not coming for this build (Demo PRD §6). The flow goes
 * candidate-confirms → Interview Scheduled directly, with the confirmed slot shown in the thread.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Interview]), SwipeMatchModule],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
