# SwipeHire — Engineering Ticket List

Derived from: *"Tinder for Jobs" Full Concept, Architecture & Build Analysis* + SwipeHire User Journey flowchart.

Each ticket is written to be pasted directly into an AI coding tool or a sprint board. Ticket IDs are stable references used in the Dependencies column and the final MVP sequence.

**Legend — Type:** `FE` Frontend · `BE` Backend · `DB` Database · `INFRA` Infrastructure · `QA` Testing

---

## EPIC 0 — Platform & Infrastructure Foundations
**Purpose:** Stand up the AWS environment, CI/CD, observability, and core service scaffolding that every other epic builds on top of. Nothing else can ship without this.

### INFRA-01 — AWS Foundation & Environment Setup
**Type:** INFRA
**Description:** Provision dev/staging/prod AWS environments: VPC, ECS Fargate cluster, RDS Postgres (Multi-AZ), ElastiCache Redis, S3 buckets (SSE-KMS encrypted), DynamoDB table for chat, SQS queues, CloudFront, and an ALB/API Gateway. Configure least-privilege IAM roles per service.
**Acceptance Criteria:**
- Dev, staging, and prod environments are provisioned and isolated with separate credentials/accounts.
- RDS Postgres, ElastiCache Redis, S3, DynamoDB, and SQS are reachable from the ECS cluster.
- All S3 buckets have default SSE-KMS encryption and public access blocked.
- IAM roles restrict each service to only the resources it needs.
**Dependencies:** None
**Priority:** Must-have for MVP
**Technical Notes:** Use Terraform or CDK — do not hand-provision resources; environments must be reproducible.

### INFRA-02 — CI/CD Pipeline
**Type:** INFRA
**Description:** Build CI/CD for the NestJS core API, the Python NLP microservice, and the React Native app: lint, test, build, and deploy on merge.
**Acceptance Criteria:**
- Every PR triggers automated lint + unit tests before merge is allowed.
- Merges to main auto-deploy to staging; production deploy requires manual approval.
- Failed builds block deployment and notify the team.
**Dependencies:** INFRA-01
**Priority:** Must-have for MVP

### INFRA-03 — Observability & Monitoring
**Type:** INFRA
**Description:** Set up CloudWatch dashboards and X-Ray tracing focused specifically on swipe→match latency, API error rates, and SQS queue depth.
**Acceptance Criteria:**
- Dashboard shows p50/p95/p99 latency for swipe and match-detection endpoints.
- Alerts fire when SQS queue depth or error rate exceed defined thresholds.
- X-Ray traces a swipe request end-to-end from API through match detection.
**Dependencies:** INFRA-01
**Priority:** Should-have
**Technical Notes:** Swipe→match latency is called out in the architecture doc as the core UX metric — instrument it first.

### INFRA-04 — Core API Service Scaffolding (NestJS)
**Type:** BE, INFRA
**Description:** Bootstrap the NestJS core API with modular structure (auth, profile, jobs, swipe, match, chat-gateway modules), global exception handling, DTO-based request validation, and environment config management.
**Acceptance Criteria:**
- NestJS app boots locally and in staging; health-check endpoint returns 200.
- Module boundaries exist for auth, profile, jobs, swipe, match, and chat-gateway.
- Invalid request payloads return structured 400 errors via DTO validation.
**Dependencies:** INFRA-01
**Priority:** Must-have for MVP

---

## EPIC 1 — Authentication & Onboarding
**Purpose:** Let candidates and recruiters securely sign up, choose a role, stay logged in, recover access, and — for recruiters — get verified before posting jobs. Maps to the "App Launch → New User? → Select Role" branch of the user journey.

### AUTH-01 — OIDC/OAuth2 Identity Integration
**Type:** BE, FE
**Description:** Integrate a managed identity provider (AWS Cognito) for signup, login, and token issuance via email/password.
**Acceptance Criteria:**
- User can sign up with email + password and receives a verification email.
- User can log in with valid credentials and receives a short-lived JWT access token (~15 min) plus a rotating refresh token.
- Invalid credentials return a generic error without revealing which field was wrong.
**Dependencies:** INFRA-04
**Priority:** Must-have for MVP
**Technical Notes:** Cognito federation model. Refresh token reuse detection is handled in AUTH-05.

### AUTH-02 — Role Selection (Seeker vs Recruiter)
**Type:** FE, BE
**Description:** After first signup, prompt the user to choose Job Seeker or Recruiter and persist it on the user record; role determines onboarding flow and app UI.
**Acceptance Criteria:**
- New user sees a role-selection screen before reaching any other app screen.
- Role is stored on the user record and cannot be self-changed after selection.
- Returning users skip role selection and land in their role-specific home screen.
**Dependencies:** AUTH-01
**Priority:** Must-have for MVP

### AUTH-03 — Auth Persistence & Biometric Login
**Type:** FE
**Description:** Persist session across app restarts using securely stored refresh tokens; add biometric unlock (Face ID/Touch ID/fingerprint) for fast re-entry.
**Acceptance Criteria:**
- A returning user with a valid stored session skips login and lands on their home screen.
- Biometric prompt appears on relaunch if enabled; successful biometric auth restores the session without re-entering credentials.
- Expired/invalid refresh tokens fall back to the standard login screen.
**Dependencies:** AUTH-01
**Priority:** Should-have
**Technical Notes:** Store tokens in iOS Keychain / Android Keystore — never AsyncStorage.

### AUTH-04 — Logout
**Type:** FE, BE
**Description:** Clear local tokens on logout and invalidate the refresh token server-side.
**Acceptance Criteria:**
- Logout clears all locally stored tokens and returns the user to the login screen.
- The invalidated refresh token can no longer be used to obtain a new access token.
**Dependencies:** AUTH-01
**Priority:** Must-have for MVP

### AUTH-05 — Password Recovery & Refresh Token Security
**Type:** BE, FE
**Description:** Implement "forgot password" email flow and refresh-token reuse detection.
**Acceptance Criteria:**
- User can request a reset email and set a new password via a time-limited, single-use reset link.
- Reset links expire after a defined window (e.g., 30 minutes).
- Reuse of an already-used refresh token invalidates all sessions for that user and forces re-authentication.
**Dependencies:** AUTH-01
**Priority:** Must-have for MVP

### AUTH-06 — Recruiter/Company Verification Gate
**Type:** BE
**Description:** Block recruiters from creating job listings until company verification (domain match or manual document review) is approved, per the "Company / Recruiter Verification" onboarding step.
**Acceptance Criteria:**
- Recruiter cannot access "Create Job Listing" until verification status is "approved."
- Signup with an email domain matching an already-verified company auto-approves.
- Manual verification (business doc upload) creates a pending record in the admin queue.
**Dependencies:** AUTH-02, ADMIN-02
**Priority:** Must-have for MVP
**Technical Notes:** This is the primary fake-job-listing defense in the architecture doc.

---

## EPIC 2 — Candidate Profile
**Purpose:** Let job seekers build a complete profile manually or via resume upload + NLP auto-fill, matching the "Upload Resume → NLP Extracts → Review/Edit → Set Preferences" flow.

### PROFILE-01 — Candidate Profile CRUD
**Type:** FE, BE, DB
**Description:** Build create/edit endpoints and UI for the core profile: headline, experience years, location, skills, one-line highlight.
**Acceptance Criteria:**
- Candidate can create and save a profile with headline, experience, location, and at least one skill.
- Candidate can edit and re-save any field, reflected immediately on their own profile view.
- Profile cannot save with missing required fields (headline, location).
**Dependencies:** AUTH-02
**Priority:** Must-have for MVP

### PROFILE-02 — Resume Upload
**Type:** FE, BE, INFRA
**Description:** Let candidates upload a resume (PDF/DOCX) to S3 via a pre-signed URL, with malware scanning before the file is considered durable.
**Acceptance Criteria:**
- Candidate can upload a PDF or DOCX up to a defined size limit (e.g., 5MB).
- Upload uses a pre-signed S3 URL; the client never receives raw AWS credentials.
- Infected files are rejected with a clear error and never persist.
**Dependencies:** INFRA-01
**Priority:** Must-have for MVP
**Technical Notes:** Lambda-triggered scan on S3 `PutObject`.

### PROFILE-03 — Resume Parsing (NLP Microservice)
**Type:** BE
**Description:** Build the Python NLP microservice that extracts skills, experience, and education from an uploaded resume and returns structured JSON.
**Acceptance Criteria:**
- Given a valid resume, the service returns structured skills/experience/education JSON within a defined time budget (e.g., <10s for a 2-page resume).
- Unparseable files return a graceful error, not a crash or blank result.
- Parsing accuracy is validated against a documented test set with a minimum accuracy threshold.
**Dependencies:** PROFILE-02, INFRA-01
**Priority:** Must-have for MVP
**Technical Notes:** Flask/FastAPI, triggered async via SQS after upload.

### PROFILE-04 — Parsed Profile Review & Edit
**Type:** FE, BE
**Description:** After parsing, show an editable, pre-filled form so the candidate can correct/complete extracted data before saving, per "Review and Edit Auto-Filled Profile."
**Acceptance Criteria:**
- All auto-extracted fields are pre-populated and editable before the profile is finalized.
- Candidate can add, remove, or correct any extracted skill, experience, or education entry.
- Saving overwrites raw parsed data with the candidate-confirmed version.
**Dependencies:** PROFILE-03
**Priority:** Must-have for MVP

### PROFILE-05 — Candidate Preferences (Location, Salary, Remote)
**Type:** FE, BE
**Description:** Let candidates set search preferences: location(s), minimum salary, remote/hybrid/onsite, industries to exclude.
**Acceptance Criteria:**
- Candidate can set and save salary floor, location preference(s), and work-mode preference.
- Saved preferences are used as default filters in job discovery.
- Preferences can be updated anytime and take effect on the next deck fetch.
**Dependencies:** PROFILE-01
**Priority:** Must-have for MVP

---

## EPIC 3 — Recruiter & Company
**Purpose:** Give recruiters a profile and verified company presence, plus their own discovery preferences — the recruiter-side counterpart to Epic 2.

### RECRUIT-01 — Recruiter Profile CRUD
**Type:** FE, BE
**Description:** Build create/edit for the recruiter's personal profile: name, title, linked company.
**Acceptance Criteria:**
- Recruiter can create and edit their profile with name, title, and linked company.
- Recruiter profile is visible to matched candidates only, never during pre-match swiping.
**Dependencies:** AUTH-02
**Priority:** Must-have for MVP

### RECRUIT-02 — Company Profile CRUD
**Type:** FE, BE
**Description:** Build company profile creation/editing: name, logo, description, industry, size.
**Acceptance Criteria:**
- Recruiter can create a company profile or attach to an existing verified company by domain match.
- Company fields can be edited by any verified recruiter linked to that company.
- Company logo displays on job cards shown to candidates.
**Dependencies:** AUTH-06
**Priority:** Must-have for MVP

### RECRUIT-03 — Company Verification Workflow
**Type:** BE
**Description:** Implement the backend logic behind AUTH-06: domain-match auto-approval and a manual document review queue.
**Acceptance Criteria:**
- Signup with a work email matching an already-verified company domain auto-approves.
- Unmatched domains can upload a business registration document, creating a pending admin-queue record.
- Rejected verifications notify the recruiter with a reason and allow resubmission.
**Dependencies:** AUTH-06, ADMIN-02
**Priority:** Must-have for MVP

### RECRUIT-04 — Recruiter Discovery Preferences
**Type:** FE, BE
**Description:** Let recruiters set default candidate-search filters: experience range, required skills, location, notice period.
**Acceptance Criteria:**
- Recruiter can set and save default filters.
- Saved preferences pre-populate candidate discovery filters on the next session.
**Dependencies:** RECRUIT-01
**Priority:** Should-have

---

## EPIC 4 — Job Management
**Purpose:** Let verified recruiters create and manage job listings that power the candidate-side swipe deck.

### JOBS-01 — Job Listing CRUD
**Type:** FE, BE, DB
**Description:** Build create/edit for job listings: title, description, required skills, salary band, location, work mode, experience requirement.
**Acceptance Criteria:**
- Verified recruiter can create a listing with all required fields.
- Recruiter can edit fields on listings they own; cannot edit another company's listing (enforced server-side).
- Listing cannot save without title, ≥1 required skill, and location/work-mode.
**Dependencies:** AUTH-06, RECRUIT-02
**Priority:** Must-have for MVP

### JOBS-02 — Job Status & Publish/Unpublish
**Type:** BE
**Description:** Implement job status states (draft, published, paused, filled/closed) and their transitions.
**Acceptance Criteria:**
- Recruiter can publish a draft job, making it visible in candidate discovery.
- Pausing/unpublishing immediately removes it from new candidate decks; existing matches are unaffected.
- A job marked "filled" archives its active matches automatically.
**Dependencies:** JOBS-01
**Priority:** Must-have for MVP

---

## EPIC 5 — Discovery & Filters
**Purpose:** Power the pre-swipe filtering the PRD treats as mandatory (not optional) on both sides, so users only see relevant cards.

### DISCOVER-01 — Job Discovery Feed for Candidates
**Type:** BE, DB
**Description:** Build the candidate-facing job query: published jobs matching saved preferences (salary, location, remote, role, skills, industry), sorted with recency as a signal, cursor-paginated.
**Acceptance Criteria:**
- Deck only shows jobs matching saved filters (salary ≥ floor, matching location/remote preference).
- Candidate can override saved filters for a single session without changing saved preferences.
- Feed excludes jobs already swiped on (either direction).
- Results are cursor-paginated with no duplicate cards on "load more."
**Dependencies:** PROFILE-05, JOBS-02, INFRA-01
**Priority:** Must-have for MVP
**Technical Notes:** Backed by Elasticsearch/Algolia for faceted + fuzzy skill search.

### DISCOVER-02 — Candidate Discovery Feed for Recruiters
**Type:** BE, DB
**Description:** Build the recruiter-facing candidate query with mandatory pre-swipe filters: min. experience, required skills, location, notice period.
**Acceptance Criteria:**
- Recruiter cannot view the candidate deck without experience-range and skill filters applied.
- Deck returns only candidates matching all active filters.
- Feed excludes candidates already swiped on for this listing.
**Dependencies:** RECRUIT-04, PROFILE-01, INFRA-01
**Priority:** Must-have for MVP

### DISCOVER-03 — Search Indexing Pipeline
**Type:** BE, INFRA
**Description:** Build the async pipeline syncing Postgres job/candidate writes into Elasticsearch so discovery stays current.
**Acceptance Criteria:**
- Job listing changes reflect in search results within a defined SLA (e.g., <30s).
- Candidate profile changes reflect in recruiter discovery within the same SLA.
- Indexing failures are retried and logged, never silently dropped.
**Dependencies:** JOBS-01, PROFILE-01, INFRA-01
**Priority:** Must-have for MVP
**Technical Notes:** Async via SQS/Kafka workers, not synchronous dual writes.

---

## EPIC 6 — Swipe Engine
**Purpose:** The core interaction loop — fast, gesture-driven, duplicate-safe, and abuse-resistant swiping.

### SWIPE-01 — Swipe Card UI & Gesture Stack
**Type:** FE
**Description:** Build the RN swipe deck: card component, Reanimated + gesture-handler swipe gestures, rolling-window rendering (3–4 mounted cards), unmount/remount on swipe.
**Acceptance Criteria:**
- User can swipe a card left or right with smooth 60fps animation on a mid-range device.
- Only 3–4 cards are mounted at any time regardless of deck size.
- Swiping the top card unmounts it and mounts the next buffered card with no visible loading state.
**Dependencies:** DISCOVER-01 or DISCOVER-02
**Priority:** Must-have for MVP
**Technical Notes:** `react-native-reanimated` v3 + `react-native-gesture-handler`, worklets on the UI thread — never the legacy `Animated` API. `React.memo` + `useCallback` on card components.

### SWIPE-02 — Card Prefetching & Buffer Management
**Type:** FE, BE
**Description:** Cursor-paginated background fetch that tops up the buffer below ~5 remaining cards, plus image prefetching for the next 2 cards.
**Acceptance Criteria:**
- Background refetch triggers automatically before the buffer runs out.
- No visible loading spinner mid-swipe under normal network conditions.
- Next 2 cards' images are prefetched and cached (`react-native-fast-image`).
**Dependencies:** SWIPE-01
**Priority:** Must-have for MVP

### SWIPE-03 — Swipe Persistence Pipeline (Redis + Async Postgres)
**Type:** BE, DB, INFRA
**Description:** Immediate Redis write on swipe for fast ack, O(1) opposite-direction lookup for match detection, async SQS push for durable Postgres persistence.
**Acceptance Criteria:**
- Swipe API acknowledges to the client in under 20ms under normal load.
- Mutual right-swipe is correctly detected via Redis lookup without a synchronous Postgres query.
- Every swipe eventually persists to Postgres via the queue, even if the client connection drops right after the Redis write.
**Dependencies:** INFRA-01, JOBS-01, PROFILE-01
**Priority:** Must-have for MVP
**Technical Notes:** The "swipe firehose" pattern — cache-first ack, queue-based durability.

### SWIPE-04 — Duplicate Swipe Prevention
**Type:** BE
**Description:** Prevent a user from swiping the same target more than once.
**Acceptance Criteria:**
- Re-swiping an already-swiped target is rejected server-side, idempotently, even on client retry.
- The already-swiped target never reappears in the deck on subsequent fetches.
**Dependencies:** SWIPE-03
**Priority:** Must-have for MVP

### SWIPE-05 — Optimistic Swipe UI
**Type:** FE
**Description:** Show the "match check" state on swipe-right immediately, without waiting for the network round trip, and reconcile silently if it didn't land.
**Acceptance Criteria:**
- UI advances immediately on swipe-right, before server confirmation.
- If the server later reports failure, the UI reconciles silently, and correct state is visible on next screen visit.
**Dependencies:** SWIPE-03
**Priority:** Should-have

### SWIPE-06 — Swipe Rate Limiting
**Type:** BE
**Description:** Enforce per-user/per-IP swipe rate limits and a soft daily right-swipe cap per job listing on the recruiter side.
**Acceptance Criteria:**
- A user exceeding the rate limit gets a clear rate-limit response and cannot swipe again until the window resets.
- Recruiters hit a soft daily right-swipe cap per listing; exceeding it requires explicit confirmation.
- Rate-limit state lives in Redis, not Postgres.
**Dependencies:** SWIPE-03
**Priority:** Must-have for MVP

### SWIPE-07 — Swipe History
**Type:** FE, BE
**Description:** Let users view their own past swipe history.
**Acceptance Criteria:**
- Candidate can view jobs they've swiped right on.
- Recruiter can view candidates they've swiped right on, per job listing.
- Left-swiped items aren't resurfaced but are recorded for duplicate-prevention.
**Dependencies:** SWIPE-03
**Priority:** Should-have

### SWIPE-08 — Fast-Track (Super Swipe)
**Type:** FE, BE
**Description:** A limited-use swipe that flags urgent interest and moves the match to the top of the other party's queue.
**Acceptance Criteria:**
- User has a defined, replenishing Fast-Track quota (e.g., N per week).
- A Fast-Tracked swipe surfaces at the top of the target's deck on their next session.
- Using one decrements the quota and is visible in swipe history.
**Dependencies:** SWIPE-03, SWIPE-07
**Priority:** Nice-to-have

### SWIPE-09 — Swipe Engine Load & Leak Testing
**Type:** QA
**Description:** Automated tests for swipe pipeline correctness under concurrent load and a sustained-swipe memory profile on the RN client.
**Acceptance Criteria:**
- Load test with concurrent swipes confirms no duplicate matches and Redis/Postgres stay consistent.
- A scripted 100+ consecutive swipe test on the RN client shows no unbounded JS heap growth.
- Thresholds are documented and run in CI for the swipe module.
**Dependencies:** SWIPE-01, SWIPE-02, SWIPE-03, SWIPE-04, SWIPE-06
**Priority:** Should-have
**Technical Notes:** Profile with Flipper; a 5-swipe smoke test is not sufficient.

---

## EPIC 7 — Matching
**Purpose:** Turn a mutual right-swipe into a durable, transactional match with a visible, explainable score and real-time notification.

### MATCH-01 — Match Detection & Transactional Creation
**Type:** BE, DB
**Description:** The dedicated match-service step that, on Redis-detected mutual right-swipe, writes the match row transactionally and prevents double-creation.
**Acceptance Criteria:**
- A mutual right-swipe produces exactly one match row, even under concurrent/retried requests from both sides.
- Match creation is atomic — a partial failure never leaves an orphaned or duplicate record.
- New matches default to "active" status.
**Dependencies:** SWIPE-03
**Priority:** Must-have for MVP

### MATCH-02 — Match Percentage Score
**Type:** BE
**Description:** Compute and display a match percentage using extracted candidate skills/experience and job requirements.
**Acceptance Criteria:**
- Every candidate card and job card displays a computed match percentage.
- Score updates via a recomputation job when either side's underlying data changes — not a stale cache.
- Scoring logic is documented so it can be explained to users (transparency requirement).
**Dependencies:** PROFILE-03, JOBS-01
**Priority:** Must-have for MVP
**Technical Notes:** Async recomputation worker, not synchronous on every card render.

### MATCH-03 — Match Screen ("It's a Match!")
**Type:** FE
**Description:** Full-screen match celebration UI shown to both parties on match creation.
**Acceptance Criteria:**
- Both parties see the match screen on next app open (or immediately if in-session).
- Screen shows the other party's name/role/company and a clear path into chat.
- Screen is dismissible and doesn't block other navigation.
**Dependencies:** MATCH-01
**Priority:** Must-have for MVP

### MATCH-04 — Match Notifications
**Type:** BE
**Description:** Push notification to both matched parties immediately on match creation.
**Acceptance Criteria:**
- Both users receive a push notification within a defined SLA (e.g., <5s), even if backgrounded.
- Tapping the notification deep-links into the match screen or chat.
**Dependencies:** MATCH-01, NOTIF-01
**Priority:** Must-have for MVP

### MATCH-05 — Match State Management
**Type:** BE
**Description:** Implement match lifecycle states (active, closed, archived) and their transitions.
**Acceptance Criteria:**
- Either party can explicitly close a match, triggering an optional feedback prompt.
- All active matches on a job auto-archive when the job is marked filled/closed.
- Archived/closed matches are read-only in chat but remain visible in history.
**Dependencies:** MATCH-01, JOBS-02
**Priority:** Must-have for MVP

### MATCH-06 — Outcome Tracking (Hired / Not Selected)
**Type:** FE, BE
**Description:** Let recruiters mark a match's final outcome, closing the loop shown in the journey's "Outcome" step.
**Acceptance Criteria:**
- Recruiter can mark a match "Hired" or "Not Selected."
- Marking "Hired" triggers the job-filled flow and archives other active matches on that job.
- Outcome is visible to the candidate in their match/history view.
**Dependencies:** MATCH-05, JOBS-02
**Priority:** Should-have

---

## EPIC 8 — Chat
**Purpose:** Unlock real-time messaging only after a match, enforcing the PII-minimization rule (no contact info before matching).

### CHAT-01 — Conversation Creation & Unlock
**Type:** BE
**Description:** Auto-create a conversation the moment a match is created, and gate access so chat is only reachable for matched pairs.
**Acceptance Criteria:**
- A conversation exists for every active match and for no non-matched pair.
- Accessing a conversation the requesting user isn't part of returns 403.
- Full resume/contact details unlock in-chat only after match, never pre-match.
**Dependencies:** MATCH-01
**Priority:** Must-have for MVP

### CHAT-02 — Real-Time Messaging (Socket.io)
**Type:** BE, FE, INFRA
**Description:** Socket.io + Redis adapter chat gateway for real-time send/receive within a matched conversation.
**Acceptance Criteria:**
- A sent message appears on the recipient's open chat within a defined SLA (e.g., <1s) when both are online.
- Messaging works correctly across multiple server instances (Redis adapter verified).
- Disconnect/reconnect never duplicates or drops in-flight messages.
**Dependencies:** CHAT-01, INFRA-01
**Priority:** Must-have for MVP

### CHAT-03 — Message Persistence
**Type:** BE, DB
**Description:** Persist messages durably (DynamoDB or partitioned Postgres) keyed by conversation ID; load history on chat open.
**Acceptance Criteria:**
- All sent messages are retrievable on chat reopen, including after app restart or device switch.
- Message history loads paginated for long conversations.
- Message store handles high write volume without loss under load test.
**Dependencies:** CHAT-02
**Priority:** Must-have for MVP

### CHAT-04 — Read Status
**Type:** BE, FE
**Description:** Track and display read/unread and delivery status per message.
**Acceptance Criteria:**
- Sender can see when a message was delivered and read.
- Unread count is visible on the conversation list without opening the chat.
**Dependencies:** CHAT-03
**Priority:** Should-have

### CHAT-05 — Push Notifications for New Messages
**Type:** BE
**Description:** Push notification when a user receives a message while backgrounded or the conversation isn't open.
**Acceptance Criteria:**
- User is notified of a new message when backgrounded, within a defined SLA.
- No notification fires if the exact conversation is currently open and foregrounded.
- Tapping the notification deep-links into that conversation.
**Dependencies:** CHAT-03, NOTIF-01
**Priority:** Must-have for MVP

### CHAT-06 — Blocking & Reporting
**Type:** FE, BE
**Description:** Let either party block the other or report a conversation for abuse review.
**Acceptance Criteria:**
- Blocking immediately prevents further messages from that user and hides the conversation for both parties.
- Reporting creates an admin-visible record with reason and message context.
- A blocked user cannot re-match with the blocker.
**Dependencies:** CHAT-03, ADMIN-03
**Priority:** Must-have for MVP

---

## EPIC 9 — Interview Scheduling
**Purpose:** Let a matched pair agree on an interview time in-app, per "Recruiter Proposes Slots → Candidate Confirms → Calendar Invite Synced."

### INTERVIEW-01 — Propose Interview Slots
**Type:** FE, BE
**Description:** Let a recruiter propose one or more time slots within a matched conversation.
**Acceptance Criteria:**
- Recruiter can propose multiple slot options from within chat.
- Proposed slots render as a structured, tappable UI element, not plain text.
**Dependencies:** CHAT-02
**Priority:** Must-have for MVP

### INTERVIEW-02 — Accept/Reject & Confirm
**Type:** FE, BE
**Description:** Let the candidate accept one proposed slot or reject all; confirm on acceptance.
**Acceptance Criteria:**
- Candidate can accept exactly one slot, confirming the interview and notifying the recruiter.
- Candidate can reject all slots, prompting the recruiter to propose new ones.
- A confirmed slot conflict (same recruiter, overlapping time, different candidate/role) is flagged, not silently allowed.
**Dependencies:** INTERVIEW-01
**Priority:** Must-have for MVP

### INTERVIEW-03 — Interview Status Tracking
**Type:** BE, FE
**Description:** Track lifecycle status (proposed, confirmed, completed, cancelled) visible to both parties.
**Acceptance Criteria:**
- Both parties see a consistent, current status in the match/chat view.
- Either party can cancel a confirmed interview, notifying the other and reverting status.
**Dependencies:** INTERVIEW-02
**Priority:** Must-have for MVP

### INTERVIEW-04 — Calendar Integration
**Type:** BE, INFRA
**Description:** Sync confirmed interviews to Google Calendar, generating invites for both parties.
**Acceptance Criteria:**
- On confirmation, both parties with a connected Google Calendar receive a matching invite.
- Cancelling the interview updates or removes the calendar event.
- Users without a connected calendar still see the confirmed slot in-app, no errors.
**Dependencies:** INTERVIEW-03
**Priority:** Should-have

### INTERVIEW-05 — Interview Notifications
**Type:** BE
**Description:** Push notifications for proposed, confirmed, and pre-interview reminder events.
**Acceptance Criteria:**
- Candidate is notified when slots are proposed.
- Both parties are notified immediately on confirmation.
- Both receive a reminder a set time before the interview (e.g., 1 hour prior).
**Dependencies:** INTERVIEW-03, NOTIF-01
**Priority:** Should-have

---

## EPIC 10 — Security & Privacy
**Purpose:** Enforce RBAC, encryption, abuse-prevention, and DPDP-compliance requirements the architecture doc treats as foundational, not optional add-ons.

### SEC-01 — RBAC Enforcement (API + Row-Level)
**Type:** BE
**Description:** Enforce role-based access control at the API gateway (seeker/recruiter/admin) and at the row level in Postgres.
**Acceptance Criteria:**
- Every protected endpoint rejects requests from an unauthorized role regardless of client-side UI restrictions.
- A recruiter for Company A cannot read/mutate Company B's listings, matches, or chats, even via a crafted request.
- An automated cross-tenant authorization test suite passes in CI.
**Dependencies:** AUTH-01, JOBS-01, RECRUIT-02
**Priority:** Must-have for MVP

### SEC-02 — Resume & Document Secure Access
**Type:** BE, INFRA
**Description:** Serve resumes exclusively via short-TTL pre-signed S3 URLs; never from a public bucket.
**Acceptance Criteria:**
- No resume/document is reachable via a permanent or public URL.
- Pre-signed URLs expire within minutes and cannot be reused after expiry.
- Resume/contact info is excluded from API responses during the pre-match swipe phase.
**Dependencies:** PROFILE-02, INFRA-01
**Priority:** Must-have for MVP

### SEC-03 — Field-Level Encryption for Sensitive PII
**Type:** BE, DB
**Description:** Apply envelope encryption to particularly sensitive fields (phone, email) beyond table-level encryption.
**Acceptance Criteria:**
- Phone and email are stored encrypted at the field level, verified by inspecting raw DB rows.
- Application code decrypts transparently for authorized reads without leaking plaintext in logs.
**Dependencies:** INFRA-01
**Priority:** Should-have

### SEC-04 — Data Deletion & Right to Erasure
**Type:** BE
**Description:** Build a "delete my account" flow that purges S3 objects and DB rows (not a soft delete), satisfying DPDP Act erasure requirements.
**Acceptance Criteria:**
- Account deletion removes profile, resume files, and PII within a documented SLA.
- Deletion cascades correctly to matches/chats without breaking the other party's remaining data.
- A deletion audit log confirms erasure occurred, without retaining the erased PII itself.
**Dependencies:** PROFILE-01, SEC-02
**Priority:** Must-have for MVP

### SEC-05 — Consent Capture at Signup
**Type:** FE, BE
**Description:** Capture explicit data-processing consent at signup per DPDP Act requirements.
**Acceptance Criteria:**
- Signup cannot complete without explicitly accepting a consent statement.
- Consent timestamp and version are recorded and retrievable per user.
**Dependencies:** AUTH-01
**Priority:** Must-have for MVP

### SEC-06 — Malware Scanning Pipeline
**Type:** BE, INFRA
**Description:** Extend the resume malware scan (PROFILE-02) to all user-uploaded assets — company logos, verification documents.
**Acceptance Criteria:**
- All uploaded files are scanned before being marked durable/available.
- Infected or malformed files are rejected with a clear, non-technical error.
**Dependencies:** INFRA-01
**Priority:** Must-have for MVP

### SEC-07 — Fake Profile / Fake Job Detection
**Type:** BE
**Description:** Apply anomaly scoring and duplicate-content detection to job descriptions and profiles, flagging likely fakes for admin review.
**Acceptance Criteria:**
- A new listing that closely duplicates existing content or matches known fake-listing patterns is flagged for admin review before appearing in discovery.
- Flagged items route to the admin moderation queue rather than auto-blocking.
**Dependencies:** JOBS-01, PROFILE-01, ADMIN-03
**Priority:** Should-have

---

## EPIC 11 — Notifications
**Purpose:** Centralize the push-notification infrastructure that matching, chat, and interview scheduling depend on. (Per-event notifications like "new match" or "new message" are scoped as acceptance criteria inside MATCH-04, CHAT-05, and INTERVIEW-05 rather than duplicated here.)

### NOTIF-01 — Push Notification Infrastructure
**Type:** BE, INFRA
**Description:** Build the SNS → FCM (Android) / APNs (iOS) dispatch pipeline and device-token registration.
**Acceptance Criteria:**
- App registers device push tokens on login and re-registers on token refresh.
- A backend-sent test notification reaches both an Android and iOS test device.
- Dispatch failures (e.g., stale token) are logged and don't crash the sending service.
**Dependencies:** INFRA-01, AUTH-01
**Priority:** Must-have for MVP

### NOTIF-02 — Notification Preferences & Center
**Type:** FE, BE
**Description:** Let users toggle notification categories and view a persistent in-app notification history.
**Acceptance Criteria:**
- User can independently enable/disable each notification category; disabled categories stop pushing within one session.
- In-app notification center lists recent notifications with read/unread state, even for categories with push disabled.
**Dependencies:** NOTIF-01
**Priority:** Should-have

---

## EPIC 12 — Admin
**Purpose:** Give the internal team the tools to verify recruiters, moderate content, and respond to abuse.

### ADMIN-01 — Admin Console Foundation
**Type:** FE, BE
**Description:** Role-gated internal admin web console with its own authenticated session.
**Acceptance Criteria:**
- Only users with the "admin" role can access the console; non-admins are rejected server-side.
- Console has a working authenticated session with logout.
**Dependencies:** SEC-01
**Priority:** Must-have for MVP

### ADMIN-02 — Recruiter Verification Queue
**Type:** FE, BE
**Description:** Queue where admins review pending recruiter/company verification submissions and approve/reject with a reason.
**Acceptance Criteria:**
- Admin can view all pending submissions with uploaded document/domain info.
- Approving/rejecting updates the recruiter's status and notifies them with next steps.
**Dependencies:** ADMIN-01, RECRUIT-03
**Priority:** Must-have for MVP

### ADMIN-03 — Content Moderation & Reports Queue
**Type:** FE, BE
**Description:** Queue where flagged jobs/profiles and user-submitted reports surface for admin review and action.
**Acceptance Criteria:**
- Admin sees all flagged/reported items with context (what was flagged, by whom or which detector, and why).
- Admin can act directly from the queue (approve, remove, warn, suspend).
**Dependencies:** ADMIN-01, SEC-07, CHAT-06
**Priority:** Must-have for MVP

### ADMIN-04 — User Management & Account Suspension
**Type:** FE, BE
**Description:** Let admins search users, view account status, and suspend/reinstate accounts.
**Acceptance Criteria:**
- Admin can search a user by email/name and view role, verification status, and moderation history.
- Suspending an account immediately blocks login and API access without deleting data.
- Reinstating restores normal access.
**Dependencies:** ADMIN-01
**Priority:** Must-have for MVP

### ADMIN-05 — Suspicious Activity Monitoring
**Type:** FE, BE
**Description:** Surface abuse signals (rate-limit violations, mass-swipe patterns, repeated reports against one user) in an admin dashboard.
**Acceptance Criteria:**
- Dashboard lists users who triggered rate limits or received multiple reports in a rolling window.
- Entries link directly to the relevant moderation action.
**Dependencies:** ADMIN-04, SWIPE-06
**Priority:** Nice-to-have

---

## Recommended MVP Implementation Sequence

This follows ticket dependencies, not just the epic order above — several epics interleave in practice.

**Phase 0 — Foundations (Wk 1–2)**
INFRA-01 → INFRA-04 → INFRA-02 → AUTH-01 → AUTH-02 → SEC-05

**Phase 1 — Auth, Profiles, Jobs Core (Wk 2–4)**
AUTH-04, AUTH-05, AUTH-06 → PROFILE-01, PROFILE-02 → RECRUIT-01, RECRUIT-02, RECRUIT-03 → JOBS-01, JOBS-02 → ADMIN-01, ADMIN-02 → SEC-02, SEC-06

**Phase 2 — NLP & Discovery (Wk 4–6)**
PROFILE-03 → PROFILE-04 → PROFILE-05 → RECRUIT-04 → DISCOVER-03 → DISCOVER-01, DISCOVER-02

**Phase 3 — Swipe Engine (Wk 6–9)**
SWIPE-01 → SWIPE-02 → SWIPE-03 → SWIPE-04 → SWIPE-06 → SEC-01 → INFRA-03

**Phase 4 — Matching (Wk 9–11)**
MATCH-01 → MATCH-02 → MATCH-03 → NOTIF-01 → MATCH-04 → MATCH-05

**Phase 5 — Chat (Wk 11–13)**
CHAT-01 → CHAT-02 → CHAT-03 → CHAT-05 → CHAT-04

**Phase 6 — Interview Scheduling & Outcomes (Wk 13–14)**
INTERVIEW-01 → INTERVIEW-02 → INTERVIEW-03 → MATCH-06

**Phase 7 — Security Hardening & Moderation (Wk 14–15)**
SEC-03 → SEC-04 → SEC-07 → CHAT-06 → ADMIN-03 → ADMIN-04

**Phase 8 — Polish, Nice-to-Haves, Launch Prep (Wk 15–16+)**
SWIPE-05, SWIPE-07, SWIPE-09 → INTERVIEW-04, INTERVIEW-05 → NOTIF-02 → SWIPE-08 (Fast-Track) → ADMIN-05

### Can safely wait past MVP
- **SWIPE-08** (Fast-Track / Super Swipe) — differentiator, not core loop.
- **ADMIN-05** (Suspicious activity dashboard) — manual review via ADMIN-03/04 covers launch-scale volume.
- **INTERVIEW-04** (Calendar sync) — in-app confirmed slot is functional without it.
- **NOTIF-02** (Notification preference center) — default-on notifications are fine for MVP.
- **SEC-03** (Field-level envelope encryption) — table-level encryption (already in INFRA-01) is an acceptable interim state; upgrade before scaling PII volume.
- **CHAT-04** (Read receipts) — nice UX polish, not launch-blocking.

### Cannot slip — these gate the core loop
AUTH-01/02/06, PROFILE-01/02/03, JOBS-01/02, DISCOVER-01/02, SWIPE-01/03/04/06, MATCH-01/02/04, CHAT-01/02/03/05, SEC-01/02/05/06, ADMIN-01/02/03/04. Without these, the app cannot demonstrate the fundamental "swipe → match → chat" value proposition end to end.
