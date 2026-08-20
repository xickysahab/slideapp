/**
 * API contract types.
 *
 * These mirror what the backend actually returns — see docs/BACKEND.md §3. Where a field is absent
 * here it is absent from the payload too, not merely unused: the blind-first rules are enforced
 * server-side, so there is no surname or contact detail on a pre-match card for the client to
 * accidentally render.
 */

export type UserRole = 'candidate' | 'recruiter';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type SwipeDirection = 'left' | 'right';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface BasicProfile {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  locationCity: string | null;
}

export interface CandidateProfile {
  userId: string;
  headline: string | null;
  currentTitle: string | null;
  yearsExperience: number | null;
  skills: string[];
  resumeS3Key: string | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  preferredWorkMode: WorkMode | null;
  noticePeriodDays: number | null;
}

export interface Company {
  id: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  verified: boolean;
}

export interface MyProfile {
  role: UserRole;
  profile: BasicProfile | null;
  candidate?: CandidateProfile | null;
  company?: Company | null;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type JobStatus = 'active' | 'filled';

/** A job as its owning recruiter sees it, on the dashboard. */
export interface Job {
  id: string;
  companyId: string;
  recruiterId?: string;
  title: string;
  description: string | null;
  techStack: string[];
  compMin: number | null;
  compMax: number | null;
  locationCity: string | null;
  workMode: WorkMode | null;
  experienceMinYears: number | null;
  status: JobStatus;
  createdAt: string;
  company?: Company;
}

/** A job as it appears on the candidate's deck (`GET /discover/jobs`). */
export interface JobCardData {
  id: string;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyVerified: boolean;
  locationCity: string | null;
  workMode: WorkMode | null;
  compMin: number | null;
  compMax: number | null;
  experienceMinYears: number | null;
  techStack: string[];
  description: string | null;
  postedAt: string;
  matchScore: number;
  /** Subset of `techStack` this candidate already has — rendered in the `matched` chip variant. */
  matchedSkills: string[];
}

/**
 * A candidate as it appears on the recruiter's deck (`GET /discover/candidates`).
 *
 * Blind-first: first name and last initial only. There is no `fullName`, `email` or resume key on
 * this type because there is none in the response.
 */
export interface CandidateCardData {
  id: string;
  firstName: string;
  lastInitial: string;
  currentTitle: string | null;
  headline: string | null;
  yearsExperience: number | null;
  locationCity: string | null;
  preferredWorkMode: WorkMode | null;
  skills: string[];
  matchedSkills: string[];
  hasResume: boolean;
  matchScore: number;
}

export type SwipeCardData =
  | { kind: 'job'; data: JobCardData }
  | { kind: 'candidate'; data: CandidateCardData };

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Swipes & matches
// ---------------------------------------------------------------------------

export interface SwipeResult {
  recorded: true;
  matched: boolean;
  matchId?: string;
}

export type MatchStatus = 'active' | 'archived' | 'closed';

export interface MatchSummary {
  id: string;
  status: MatchStatus;
  matchScore: number | null;
  matchedAt: string;
  job: { id: string; title: string; companyName: string | null };
  /** Full name — post-match visibility. Contact details are never included. */
  counterparty: { id: string; name: string };
  lastMessage: { content: string; sentAt: string; fromMe: boolean } | null;
  unreadCount: number;
  outcomeNote: string | null;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  sentAt: string;
  readAt: string | null;
}

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export interface InterviewSlot {
  start: string;
  end: string;
  timezone: string;
}

export interface Interview {
  id: string;
  matchId: string;
  proposedBy: string;
  proposedSlots: InterviewSlot[];
  confirmedSlot: InterviewSlot | null;
  status: 'proposed' | 'confirmed';
}

// ---------------------------------------------------------------------------
// Realtime payloads (docs/BACKEND.md §4)
// ---------------------------------------------------------------------------

export interface MatchCreatedEvent {
  matchId: string;
  jobId: string;
  jobTitle: string;
  companyName: string | null;
  matchScore: number | null;
  matchedAt: string;
}

export interface MatchOutcomeEvent {
  matchId: string;
  status: MatchStatus;
  outcome: 'hired' | 'not_selected';
  outcomeNote: string | null;
}

export interface InterviewProposedEvent {
  matchId: string;
  interviewId: string;
  proposedSlots: InterviewSlot[];
}

export interface InterviewConfirmedEvent {
  matchId: string;
  interviewId: string;
  confirmedSlot: InterviewSlot;
}
