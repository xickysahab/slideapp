import { IsString, Matches, MaxLength } from 'class-validator';

export class ParseResumeDto {
  /**
   * The object key returned by the upload-url request.
   *
   * The pattern accepts only the exact shape this server hands out — two UUIDs and a .pdf. That
   * rejects `..` segments and leading slashes outright, so a key can't be walked out of its own
   * prefix before the ownership check in ResumeService even runs.
   */
  @IsString()
  @MaxLength(200)
  @Matches(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i, { message: 'Malformed resume key' })
  key!: string;
}
