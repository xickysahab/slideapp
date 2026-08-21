import type {
  CandidateCardData,
  ChatMessage,
  Company,
  Interview,
  InterviewSlot,
  Job,
  JobCardData,
  MatchSummary,
  MyProfile,
  Page,
  SwipeDirection,
  SwipeResult,
  WorkMode,
} from '../../types';
import { api } from './client';

/**
 * Every API call the app makes, one function per endpoint.
 *
 * Screens call these rather than `api.get('/some/path')` directly, so a path or shape change has
 * exactly one place to be updated. Mirrors docs/handoff/Backend.md §3.
 */

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface ProfileUpdate {
  fullName?: string;
  locationCity?: string;
  avatarUrl?: string;
  headline?: string;
  currentTitle?: string;
  yearsExperience?: number;
  skills?: string[];
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  preferredWorkMode?: WorkMode;
  noticePeriodDays?: number;
}

export const profileApi = {
  me: () => api.get<MyProfile>('/profile/me'),
  update: (body: ProfileUpdate) => api.patch<MyProfile>('/profile', body),
  upsertCompany: (body: { name: string; logoUrl?: string; industry?: string }) =>
    api.put<Company>('/profile/company', body),
};

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface ResumeParseResult {
  skills: string[];
  textLength: number;
  resumeKey: string;
}

export const resumeApi = {
  requestUpload: () => api.post<{ uploadUrl: string; key: string }>('/resume/upload-url'),
  parse: (key: string) => api.post<ResumeParseResult>('/resume/parse', { key }),
  downloadUrl: () => api.get<{ url: string }>('/resume/download-url'),
  remove: () => api.delete<void>('/resume'),

  /**
   * Uploads the file straight to storage using the signed URL.
   *
   * Deliberately not routed through `api` — this doesn't go to our backend at all, carries no auth
   * header, and sends bytes rather than JSON.
   */
  async uploadFile(uploadUrl: string, fileUri: string): Promise<void> {
    const file = await fetch(fileUri);
    const blob = await file.blob();

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: blob,
    });

    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  },
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface JobInput {
  title: string;
  description?: string;
  techStack: string[];
  compMin?: number;
  compMax?: number;
  locationCity?: string;
  workMode?: WorkMode;
  experienceMinYears?: number;
}

export const jobsApi = {
  create: (body: JobInput) => api.post<Job>('/jobs', body),
  /** The recruiter dashboard. */
  mine: () => api.get<Job[]>('/jobs/mine'),
  byId: (id: string) => api.get<Job>(`/jobs/${id}`),
  update: (id: string, body: Partial<JobInput>) => api.patch<Job>(`/jobs/${id}`, body),
  setStatus: (id: string, status: 'active' | 'filled') =>
    api.patch<Job>(`/jobs/${id}/status`, { status }),
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export const discoverApi = {
  jobs: (cursor?: string) =>
    api.get<Page<JobCardData>>(`/discover/jobs${cursor ? `?cursor=${cursor}` : ''}`),
  candidates: (jobId: string, cursor?: string) =>
    api.get<Page<CandidateCardData>>(
      `/discover/candidates?jobId=${jobId}${cursor ? `&cursor=${cursor}` : ''}`,
    ),
};

// ---------------------------------------------------------------------------
// Swipes
// ---------------------------------------------------------------------------

export const swipeApi = {
  /** Candidate swiping a job. The target identifies everything else, so no jobId is sent. */
  onJob: (jobId: string, direction: SwipeDirection) =>
    api.post<SwipeResult>('/swipes', { targetId: jobId, targetType: 'job', direction }),

  /** Recruiter swiping a candidate, always for one specific listing. */
  onCandidate: (candidateId: string, jobId: string, direction: SwipeDirection) =>
    api.post<SwipeResult>('/swipes', {
      targetId: candidateId,
      targetType: 'candidate',
      direction,
      jobId,
    }),
};

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export const matchesApi = {
  list: () => api.get<MatchSummary[]>('/matches'),
  byId: (id: string) => api.get<MatchSummary>(`/matches/${id}`),
  setOutcome: (id: string, outcome: 'hired' | 'not_selected', note?: string) =>
    api.patch<{ id: string; status: string }>(`/matches/${id}/outcome`, { outcome, note }),
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export const chatApi = {
  history: (matchId: string, before?: string) =>
    api.get<Page<ChatMessage>>(
      `/matches/${matchId}/messages${before ? `?before=${before}` : ''}`,
    ),
  send: (matchId: string, content: string) =>
    api.post<ChatMessage>(`/matches/${matchId}/messages`, { content }),
  markRead: (matchId: string) =>
    api.post<{ updated: number }>(`/matches/${matchId}/messages/read`),
};

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export const interviewApi = {
  get: (matchId: string) => api.get<Interview | null>(`/matches/${matchId}/interview`),
  propose: (matchId: string, slots: InterviewSlot[]) =>
    api.post<Interview>(`/matches/${matchId}/interview`, { slots }),
  accept: (matchId: string, slotIndex: number) =>
    api.post<Interview>(`/matches/${matchId}/interview/accept`, { slotIndex }),
};
