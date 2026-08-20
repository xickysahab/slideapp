import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PDFParse } from 'pdf-parse';
import { Repository } from 'typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import type { UserRole } from '../../database/entities/user.entity';
import { StorageService } from '../../shared/storage/storage.service';
import { extractSkills } from './skill-matcher';

export interface ResumeParseResult {
  skills: string[];
  /** How much text came out. Zero means a scanned or image-only PDF, not an unskilled candidate. */
  textLength: number;
  resumeKey: string;
}

/** Every PDF begins with these bytes. */
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    @InjectRepository(CandidateProfile) private readonly candidates: Repository<CandidateProfile>,
    private readonly storage: StorageService,
  ) {}

  /** Hands back a signed URL the client PUTs the PDF to directly, so the file skips this process. */
  async requestUpload(userId: string, role: UserRole) {
    this.assertCandidate(role);
    const key = this.storage.buildResumeKey(userId);
    return this.storage.createSignedUploadUrl(key);
  }

  /**
   * Parses an uploaded resume and writes the extracted skills onto the candidate's profile.
   *
   * Runs synchronously. Architecture §1 drops the queue for the demo, and at one upload at a time a
   * few seconds in the request is fine — the client shows the parsing screen for exactly this.
   */
  async processUpload(userId: string, role: UserRole, key: string): Promise<ResumeParseResult> {
    this.assertCandidate(role);
    this.assertKeyBelongsTo(userId, key);

    const file = await this.storage.downloadObject(key);

    /**
     * Content sniffing, not the extension or the declared MIME type. The bucket restricts
     * Content-Type, but that header is set by whoever performs the upload — and the upload is a
     * direct client-to-storage PUT, so it is exactly as trustworthy as the client. The first bytes
     * are the only claim about this file the server can actually check.
     */
    if (!file.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      await this.storage.deleteObject(key);
      throw new BadRequestException('That file is not a PDF');
    }

    const text = await this.extractText(file, key);

    const { skills, textLength } = extractSkills(text);

    if (textLength === 0) {
      // A scanned resume is a real thing and produces zero text. Saying "no skills found" here
      // would send the user hunting for the wrong problem; OCR is out of scope (Architecture §6).
      await this.storage.deleteObject(key);
      throw new UnprocessableEntityException(
        "This looks like a scanned PDF with no selectable text. Upload a text-based export and we'll read it.",
      );
    }

    const existing = await this.candidates.findOne({ where: { userId } });

    // Replacing a resume shouldn't leave the old object paying rent in the bucket forever.
    if (existing?.resumeS3Key && existing.resumeS3Key !== key) {
      await this.storage.deleteObject(existing.resumeS3Key).catch((err: Error) => {
        this.logger.warn(`Could not remove replaced resume ${existing.resumeS3Key}: ${err.message}`);
      });
    }

    await this.candidates.save(
      this.candidates.create({ ...(existing ?? {}), userId, resumeS3Key: key, skills }),
    );

    if (skills.length === 0) {
      // Not an error: the review screen lets the user add skills by hand, which is the whole point
      // of it existing (Frontend Spec §2, candidate screen 8).
      this.logger.log(`No known skills matched in ${key} (${textLength} chars of text)`);
    }

    return { skills, textLength, resumeKey: key };
  }

  /** Short-lived signed URL for the candidate's own resume. */
  async getDownloadUrl(userId: string, role: UserRole): Promise<{ url: string }> {
    this.assertCandidate(role);

    const profile = await this.candidates.findOne({ where: { userId } });
    if (!profile?.resumeS3Key) throw new NotFoundException('No resume uploaded yet');

    return { url: await this.storage.createSignedDownloadUrl(profile.resumeS3Key) };
  }

  /**
   * Deletes the resume for real — the stored object as well as the reference.
   *
   * Resume-only deletion, independent of deleting the account, is a DPDP requirement in the full
   * Security doc. It's cheap here and there's no reason to leave it for later.
   */
  async deleteResume(userId: string, role: UserRole): Promise<void> {
    this.assertCandidate(role);

    const profile = await this.candidates.findOne({ where: { userId } });
    if (!profile?.resumeS3Key) throw new NotFoundException('No resume uploaded yet');

    await this.storage.deleteObject(profile.resumeS3Key);
    // Skills stay: the user may have edited them by hand, and silently emptying their profile
    // because they removed a file would be a surprise.
    await this.candidates.save({ ...profile, resumeS3Key: null });
  }

  /**
   * pdf-parse v2 is a class holding a live document handle, not the one-shot function v1 exposed,
   * so the parser is destroyed in a `finally` — leaking one per upload would slowly eat the process.
   */
  private async extractText(file: Buffer, key: string): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(file) });
    try {
      return (await parser.getText()).text;
    } catch (err) {
      this.logger.warn(`pdf-parse failed for ${key}: ${(err as Error).message}`);
      await this.storage.deleteObject(key);
      throw new UnprocessableEntityException("That PDF couldn't be read. Try exporting it again.");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  private assertCandidate(role: UserRole): void {
    if (role !== 'candidate') throw new ForbiddenException('Only candidates have a resume');
  }

  /**
   * The object key arrives from the client, so it has to be checked rather than trusted. Keys are
   * namespaced by user id at creation; requiring that prefix stops one candidate naming another's
   * key and having their resume parsed into their own profile.
   */
  private assertKeyBelongsTo(userId: string, key: string): void {
    if (!key.startsWith(`${userId}/`)) {
      // 404, not 403 — "exists but not yours" and "doesn't exist" must be indistinguishable
      // (Demo Security Baseline §1).
      throw new NotFoundException('Resume not found');
    }
  }
}
