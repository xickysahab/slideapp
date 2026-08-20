import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Job creation — Demo PRD §2 row 7: "Simple form, no multi-step guardrails".
 *
 * companyId and recruiterId are absent by design. Both are derived from the authenticated caller;
 * accepting either from the body would let a recruiter post under someone else's company.
 */
export class CreateJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /**
   * What the match score is computed against, so an empty stack would make every candidate score
   * identically — hence the minimum of one.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  techStack!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  compMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  compMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCity?: string;

  @IsOptional()
  @IsIn(['remote', 'hybrid', 'onsite'])
  workMode?: 'remote' | 'hybrid' | 'onsite';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  experienceMinYears?: number;
}

/** Same fields, all optional. Status is not editable here — see PATCH /jobs/:id/status. */
export class UpdateJobDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true }) techStack?: string[];
  @IsOptional() @IsInt() @Min(0) compMin?: number;
  @IsOptional() @IsInt() @Min(0) compMax?: number;
  @IsOptional() @IsString() @MaxLength(120) locationCity?: string;
  @IsOptional() @IsIn(['remote', 'hybrid', 'onsite']) workMode?: 'remote' | 'hybrid' | 'onsite';
  @IsOptional() @IsInt() @Min(0) @Max(40) experienceMinYears?: number;
}

export class UpdateJobStatusDto {
  @IsIn(['active', 'filled'])
  status!: 'active' | 'filled';
}
