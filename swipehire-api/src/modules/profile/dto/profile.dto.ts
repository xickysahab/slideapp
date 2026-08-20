import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Profile update payloads.
 *
 * Basic and candidate-specific fields share one DTO so a single onboarding screen submits once and
 * lands atomically. The service, not the pipe, is what rejects a recruiter sending candidate
 * fields — role isn't knowable at validation time.
 *
 * Every field is optional: this is a PATCH, and the onboarding flow fills the profile in over
 * several screens (Frontend Spec §2, candidate screens 5 and 9).
 */
export class UpdateProfileDto {
  // ---- Both roles -------------------------------------------------------
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCity?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatarUrl?: string;

  // ---- Candidate only ---------------------------------------------------
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentTitle?: string;

  // Upper bound is a sanity check, not a policy — it stops a fat-fingered 500 from ranking someone
  // above every real candidate in the experience factor of the match score.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @ArrayMaxSize(50)
  skills?: string[];

  /** Annual, in rupees. */
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedSalaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedSalaryMax?: number;

  @IsOptional()
  @IsIn(['remote', 'hybrid', 'onsite'])
  preferredWorkMode?: 'remote' | 'hybrid' | 'onsite';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  noticePeriodDays?: number;
}

/**
 * Company setup — Frontend Spec §2, recruiter screen 2: "Name, logo, industry — skip size/website".
 *
 * `verified` is deliberately absent. It's auto-true in this build (Demo PRD §2 row 4), and letting
 * a client set it would hand out the trust badge on request.
 */
export class UpsertCompanyDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;
}
