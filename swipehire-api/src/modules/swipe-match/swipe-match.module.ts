import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Swipe } from '../../database/entities/swipe.entity';
import { SwipeService } from './swipe.service';

/**
 * SwipeMatchModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: swipes, matches
 * Built in:    the read side here, for the discovery feed; recording swipes and creating matches
 *              follow with the match pipeline.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Swipe])],
  providers: [SwipeService],
  exports: [SwipeService],
})
export class SwipeMatchModule {}
