import { IsNumberString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class MessageHistoryQuery {
  /** A message id to page back from. BIGSERIAL ids are monotonic, so the id is the cursor. */
  @IsOptional()
  @IsNumberString()
  before?: string;
}
