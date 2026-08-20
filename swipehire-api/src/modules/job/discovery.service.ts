import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import { Job } from '../../database/entities/job.entity';
import { Profile } from '../../database/entities/profile.entity';
import type { UserRole } from '../../database/entities/user.entity';
import { SwipeService } from '../swipe-match/swipe.service';
import { computeMatch, type MatchBreakdown } from '../../shared/matching/match-score';

/** Cards per page. Matches the full spec's 20 (Architecture §8 / Frontend Spec §8). */
const PAGE_SIZE = 20;

export interface JobCard {
  id: string;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyVerified: boolean;
  locationCity: string | null;
  workMode: string | null;
  compMin: number | null;
  compMax: number | null;
  experienceMinYears: number | null;
  techStack: string[];
  description: string | null;
  postedAt: Date;
  matchScore: number;
  matchedSkills: string[];
}

export interface CandidateCard {
  id: string;
  firstName: string;
  lastInitial: string;
  currentTitle: string | null;
  headline: string | null;
  yearsExperience: number | null;
  locationCity: string | null;
  preferredWorkMode: string | null;
  skills: string[];
  matchedSkills: string[];
  hasResume: boolean;
  matchScore: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(CandidateProfile) private readonly candidates: Repository<CandidateProfile>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    private readonly swipes: SwipeService,
  ) {}

  /**
   * Jobs for a candidate's deck, best match first.
   *
   * Scoring happens in the application rather than in SQL, so the whole eligible set is loaded and
   * sorted in memory. That is fine at the scale this build targets — Demo PRD §4 seeds 15–20 jobs —
   * and it keeps the scoring function a plain, testable unit. It is also the first thing that would
   * have to change under real load, which is why the note is here rather than in a commit message.
   */
  async discoverJobs(userId: string, role: UserRole, cursor?: string): Promise<Page<JobCard>> {
    if (role !== 'candidate') throw new ForbiddenException('Only candidates browse jobs');

    const profile = await this.candidates.findOne({ where: { userId } });
    const seen = await this.swipes.getSwipedTargetIds(userId, 'job', null);

    const jobs = await this.jobs.find({
      where: { status: 'active', ...(seen.length ? { id: Not(In(seen)) } : {}) },
      relations: { company: true },
      order: { createdAt: 'DESC' },
    });

    const scored = jobs
      .map((job) => {
        const match = computeMatch({
          candidateSkills: profile?.skills ?? [],
          jobTechStack: job.techStack,
          candidateYears: profile?.yearsExperience ?? null,
          jobMinYears: job.experienceMinYears,
        });
        return { job, match };
      })
      .sort(this.byScoreThenRecency((entry) => [entry.match.score, entry.job.createdAt]));

    return this.paginate(
      scored.map(({ job, match }) => this.toJobCard(job, match)),
      cursor,
    );
  }

  /**
   * Candidates for one of the recruiter's listings, best match first.
   *
   * Blind-first, and enforced here rather than in the client: the response carries a first name and
   * a last initial, and no email, phone or full name at all. Demo Security Baseline §1 is explicit
   * that hiding these in the UI while the API still returns them undercuts the exact story the
   * product is telling — so the fields never enter the payload in the first place.
   */
  async discoverCandidates(
    userId: string,
    role: UserRole,
    jobId: string,
    cursor?: string,
  ): Promise<Page<CandidateCard>> {
    if (role !== 'recruiter') throw new ForbiddenException('Only recruiters browse candidates');

    // Ownership: the deck is scoped to a listing, and a recruiter may only open their own.
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.recruiterId !== userId) throw new NotFoundException('Job not found');

    const seen = await this.swipes.getSwipedTargetIds(userId, 'candidate', jobId);

    const profiles = await this.candidates.find({
      where: seen.length ? { userId: Not(In(seen)) } : {},
    });

    // A candidate with no skills recorded has not finished onboarding; showing them would put an
    // empty card in the deck, which reads as a bug rather than as an honest blank.
    const eligible = profiles.filter((c) => c.skills.length > 0);
    if (eligible.length === 0) return { items: [], nextCursor: null };

    const basics = await this.profiles.find({
      where: { userId: In(eligible.map((c) => c.userId)) },
    });
    const nameByUser = new Map(basics.map((b) => [b.userId, b.fullName]));

    const scored = eligible
      .map((candidate) => ({
        candidate,
        fullName: nameByUser.get(candidate.userId) ?? '',
        match: computeMatch({
          candidateSkills: candidate.skills,
          jobTechStack: job.techStack,
          candidateYears: candidate.yearsExperience,
          jobMinYears: job.experienceMinYears,
        }),
      }))
      // Nobody without a name has finished onboarding either.
      .filter((entry) => entry.fullName.trim().length > 0)
      .sort((a, b) => b.match.score - a.match.score);

    return this.paginate(
      scored.map((entry) => this.toCandidateCard(entry.candidate, entry.fullName, entry.match)),
      cursor,
    );
  }

  private toJobCard(job: Job, match: MatchBreakdown): JobCard {
    return {
      id: job.id,
      title: job.title,
      companyName: job.company?.name ?? '',
      companyLogoUrl: job.company?.logoUrl ?? null,
      companyVerified: job.company?.verified ?? false,
      locationCity: job.locationCity,
      workMode: job.workMode,
      compMin: job.compMin,
      compMax: job.compMax,
      experienceMinYears: job.experienceMinYears,
      techStack: job.techStack,
      description: job.description,
      postedAt: job.createdAt,
      matchScore: match.score,
      matchedSkills: match.skills.matched,
      // recruiterId is deliberately absent: which account posted a listing is not a candidate's
      // business before a match exists.
    };
  }

  /**
   * Splits a stored full name into the only two pieces a recruiter may see pre-match.
   *
   * Deliberately lossy. "Aditi Kulkarni" becomes "Aditi" + "K", and the surname does not travel
   * anywhere the client could recover it from.
   */
  private toCandidateCard(
    candidate: CandidateProfile,
    fullName: string,
    match: MatchBreakdown,
  ): CandidateCard {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastInitial = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';

    return {
      id: candidate.userId,
      firstName,
      lastInitial: lastInitial.toUpperCase(),
      currentTitle: candidate.currentTitle,
      headline: candidate.headline,
      yearsExperience: candidate.yearsExperience,
      locationCity: null, // lives on `profiles`; city is shown post-match only
      preferredWorkMode: candidate.preferredWorkMode,
      skills: candidate.skills,
      matchedSkills: match.skills.matched,
      // The key itself never leaves the server — a recruiter gets a signed URL post-match instead.
      hasResume: candidate.resumeS3Key !== null,
      matchScore: match.score,
    };
  }

  /** Ties break on recency so the order is stable rather than dependent on row order. */
  private byScoreThenRecency<T>(key: (item: T) => [number, Date]) {
    return (a: T, b: T) => {
      const [scoreA, dateA] = key(a);
      const [scoreB, dateB] = key(b);
      return scoreB - scoreA || dateB.getTime() - dateA.getTime();
    };
  }

  /**
   * Opaque offset cursor.
   *
   * Ranking is computed rather than stored, so there is no column to seek on — the honest options
   * are an offset or materialising scores. At 15–20 seeded rows the offset costs nothing, and the
   * cursor stays opaque so swapping it for a real keyset cursor later doesn't change the contract.
   */
  private paginate<T>(items: T[], cursor?: string): Page<T> {
    const offset = this.decodeCursor(cursor);
    const slice = items.slice(offset, offset + PAGE_SIZE);
    const next = offset + PAGE_SIZE;

    return {
      items: slice,
      nextCursor: next < items.length ? Buffer.from(String(next)).toString('base64url') : null,
    };
  }

  private decodeCursor(cursor?: string): number {
    if (!cursor) return 0;
    const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
    // A malformed cursor restarts the deck rather than 500-ing mid-demo.
    return Number.isInteger(decoded) && decoded >= 0 ? decoded : 0;
  }
}
