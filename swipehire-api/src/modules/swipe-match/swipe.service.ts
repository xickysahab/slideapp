import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { Swipe, type SwipeTargetType } from '../../database/entities/swipe.entity';

/**
 * Read side of the swipe store.
 *
 * Recording swipes and deriving matches lands with the match pipeline; what exists here is what the
 * discovery feed needs — "which targets has this actor already dealt with" — exposed as a service
 * method so JobModule never queries the swipes table itself (Demo Architecture §2 module ownership).
 */
@Injectable()
export class SwipeService {
  constructor(@InjectRepository(Swipe) private readonly swipes: Repository<Swipe>) {}

  /**
   * Target ids this actor has already swiped on, in either direction.
   *
   * Both directions, because a left swipe is permanent: Demo PRD §5 makes silent, irreversible
   * passes load-bearing for the trust model, so a passed card must never resurface.
   *
   * `jobId` scopes recruiter swipes to one listing. Pass null for candidate→job swipes.
   */
  async getSwipedTargetIds(
    actorId: string,
    targetType: SwipeTargetType,
    jobId: string | null,
  ): Promise<string[]> {
    const rows = await this.swipes.find({
      where: { actorId, targetType, jobId: jobId === null ? IsNull() : jobId },
      select: { targetId: true },
    });

    return rows.map((row) => row.targetId);
  }
}
