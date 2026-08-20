/**
 * Shared domain types. Field names mirror the demo schema in
 * docs/SwipeHire-DEMO-Architecture.md §3 so the client and the API don't drift.
 */

export type WorkMode = 'remote' | 'hybrid' | 'onsite';

export type SwipeDirection = 'left' | 'right';

/** A job as it appears on the candidate's deck (Frontend Spec §5). */
export interface JobCardData {
  id: string;
  title: string;
  companyName: string;
  companyLogoUrl?: string | null;
  locationCity: string;
  workMode: WorkMode;
  /** Annual, in rupees. Null when the recruiter didn't disclose — the card says so rather than hiding the row. */
  compMin: number | null;
  compMax: number | null;
  experienceMinYears: number;
  experienceMaxYears?: number | null;
  techStack: string[];
  description: string;
  postedAt: string;
  /** 0–100, computed server-side (Demo Architecture §5). */
  matchScore: number;
  /** Subset of `techStack` this candidate already has — rendered in the `matched` chip variant. */
  matchedSkills: string[];
}

/**
 * A candidate as it appears on the recruiter's deck (Frontend Spec §6).
 *
 * Blind-first by design: `firstName` + `lastInitial` only, never a full name or a photo pre-match.
 * The API is what withholds the rest (Demo Security Baseline §1) — this type reflects that, so
 * there is no field here for the client to accidentally render.
 */
export interface CandidateCardData {
  id: string;
  firstName: string;
  lastInitial: string;
  currentTitle: string;
  yearsExperience: number;
  locationCity: string;
  preferredWorkMode: WorkMode;
  skills: string[];
  /** Subset of `skills` matching this job's requirements — ranked first in the chip row. */
  matchedSkills: string[];
  keyAchievement?: string | null;
  hasResume: boolean;
  matchScore: number;
}

export type SwipeCardData =
  | { kind: 'job'; data: JobCardData }
  | { kind: 'candidate'; data: CandidateCardData };
