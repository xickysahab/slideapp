import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ParseResumeDto } from './dto/resume.dto';
import { ResumeService } from './resume.service';

/**
 * Upload is a two-step handshake: ask for a signed URL, PUT the file straight to storage, then tell
 * the server to parse it. The PDF never passes through this process, which keeps multi-megabyte
 * bodies off the API and matches how the full spec does it.
 */
@Controller('resume')
@UseGuards(JwtAuthGuard)
export class ResumeController {
  constructor(private readonly resume: ResumeService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  requestUpload(@CurrentUser() user: AuthenticatedUser) {
    return this.resume.requestUpload(user.id, user.role);
  }

  /** Called once the client's PUT finishes. Returns the skills for the review-and-edit screen. */
  @Post('parse')
  @HttpCode(HttpStatus.OK)
  parse(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParseResumeDto) {
    return this.resume.processUpload(user.id, user.role, dto.key);
  }

  @Get('download-url')
  download(@CurrentUser() user: AuthenticatedUser) {
    return this.resume.getDownloadUrl(user.id, user.role);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.resume.deleteResume(user.id, user.role);
  }
}
