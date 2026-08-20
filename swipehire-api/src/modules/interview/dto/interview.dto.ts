import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsString,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export class SlotDto {
  @IsISO8601({ strict: true })
  start!: string;

  @IsISO8601({ strict: true })
  end!: string;

  @IsString()
  @MaxLength(64)
  timezone!: string;
}

export class ProposeInterviewDto {
  /**
   * Between one and five options. More than a handful stops being a choice and starts being a
   * scheduling puzzle, which is the opposite of what an in-chat proposal is for.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}

export class AcceptInterviewDto {
  /** Index into the proposed slots, so the candidate can't accept a slot nobody offered. */
  @IsInt()
  @Min(0)
  @Max(4)
  slotIndex!: number;
}
