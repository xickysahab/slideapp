import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * One swipe per request — Demo Frontend Spec §5 drops the full spec's batched array body, since
 * there's no debounce or flush timing to get right at demo volume.
 */
export class RecordSwipeDto {
  @IsUUID()
  targetId!: string;

  @IsIn(['job', 'candidate'])
  targetType!: 'job' | 'candidate';

  @IsIn(['left', 'right'])
  direction!: 'left' | 'right';

  /**
   * Which listing a recruiter is swiping for. Required for recruiters, rejected for candidates —
   * enforced in the service, where the caller's role is known.
   */
  @IsOptional()
  @IsUUID()
  jobId?: string;
}

export class SetOutcomeDto {
  @IsIn(['hired', 'not_selected'])
  outcome!: 'hired' | 'not_selected';

  /** Optional note shown to a candidate who wasn't selected. Skipping it is a first-class path. */
  @IsOptional()
  note?: string;
}
