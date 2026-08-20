# SwipeHire — Security & Access Document

**Version:** 1.0
**Prepared for:** SwipeHire (dual-sided swipe-based hiring marketplace)
**Scope:** Authentication, authorization, data security, and access control for the SwipeHire platform (React Native app → NestJS modular monolith → PostgreSQL/pgvector, Redis, Socket.io, S3)
**Audience:** Engineering, security review, and any future auditor/investor doing technical diligence

---

## 0. Reference Architecture (assumed for this document)

Every rule below is written against this baseline. If the stack changes, revisit the relevant section.

```
React Native App (iOS/Android)
        │  HTTPS (REST) + WSS (Socket.io)
        ▼
API Gateway / Load Balancer (TLS termination)
        │
        ▼
NestJS Modular Monolith
  ├─ Auth Module
  ├─ Profile/Candidate Module
  ├─ Recruiter/Job Module
  ├─ Swipe Module
  ├─ Match Module
  ├─ Chat Module (Socket.io + Redis adapter)
  └─ Admin Module
        │
   ┌────┼─────────────┬───────────────┐
   ▼    ▼              ▼               ▼
PostgreSQL        Redis           S3 (private)   Async Workers
(+pgvector,       (swipe buffer,  (resumes,       (resume parsing/NLP,
 HNSW index,       match cache,    documents,      notifications,
 RLS enabled)      rate limits,    encrypted)      match scoring)
                   sessions)
```

Candidates and recruiters are two roles inside one auth system. There is no separate app/API for each — the same endpoints are gated by role and ownership at every layer described below.

---

## 1. Authentication

### Plain English

SwipeHire needs to be sure of two things on every request: *who* is calling, and that the credential they're using hasn't been stolen or replayed. Because candidates and recruiters both handle sensitive data (resumes, company info, private chat), authentication has to be stronger than a typical consumer app — closer to what a fintech app does than what a social app does.

People should be able to sign up with email/password, or skip that entirely with Google or Apple sign-in. OTP (via SMS or email) is used for account recovery and for verifying a recruiter's work identity, not as the primary daily login method — OTP over SMS is phishable (SIM swap) and shouldn't be the only thing standing between an attacker and a resume database.

Once someone is logged in, the app shouldn't ask them to log in again every few minutes, but a stolen session also shouldn't stay valid forever. This is what access/refresh tokens solve: a short-lived token does the daily work, and a longer-lived one is used only to mint new short-lived ones, so a leaked access token has a small window of danger.

### Implementation

**Supported methods**
| Method | Use case | Notes |
|---|---|---|
| Email + password | Primary for both roles | Argon2id hashing (preferred over bcrypt for memory-hardness), min. 10 chars, breach-list check (e.g., HaveIBeenPwned k-anonymity API) at signup |
| Google OAuth 2.0 / OpenID Connect | Fast signup, reduces password-reuse risk | Verify `email_verified` claim before trusting the email |
| Apple Sign-In | Required if shipping on iOS App Store with other 3rd-party logins | Handle Apple's private relay email correctly for notifications |
| OTP (email or SMS, 6-digit, 5 min TTL) | Password reset, recruiter work-email verification, step-up auth for suspicious sessions | Never as the sole factor for login to a fresh device carrying an existing account |
| Biometric unlock (Face ID / fingerprint) | Returning-user app launch, shown as "Login / Biometric Auth" in the app-launch flow | **Local only** — it unlocks the on-device Secure Enclave/Keystore entry holding the existing refresh token; it is never a server-side auth factor and never bypasses the token issuance/rotation rules below. If biometric unlock fails or is unavailable, the app falls back to password/OTP login, not to a degraded auth path. |

**Tokens**
- **Access token:** JWT (RS256, not HS256 — asymmetric so only the auth service can sign, but any service can verify with the public key), 15-minute expiry, contains `sub` (user id), `role`, `token_version`, `iat`/`exp`. Never put PII (email, name) in the JWT payload — it's decodable by anyone holding it.
- **Refresh token:** opaque random 256-bit token (not a JWT), 30-day expiry, stored **hashed** (SHA-256) in Postgres/Redis, one row per device/session.
- **Rotation:** every refresh call issues a brand-new refresh token and invalidates the old one (rotation). If an already-used refresh token is presented again, treat it as **theft** — revoke the entire token family (all tokens issued from that login chain) and force re-authentication on all of that user's devices.
- **Token expiry summary:** access 15 min / refresh 30 days / OTP 5 min / password reset link 15 min.

**Session management**
- Each login creates a session row: `session_id, user_id, device_fingerprint, ip, user_agent, created_at, last_seen_at, refresh_token_hash`.
- Users can view "Active sessions" and revoke any of them individually (kills that session's refresh token immediately).
- Redis mirrors active session IDs for fast lookup on every WebSocket connection (chat) without hitting Postgres per message.

**Logout**
- Logout revokes the specific refresh token (delete/blacklist its hash) and closes any live Socket.io connection tied to that session. Access tokens already issued remain technically valid until they expire (max 15 min) — this is the accepted tradeoff for stateless JWTs; keep access-token lifetime short specifically because of this.
- "Log out of all devices" bumps `token_version` on the user row — all existing access tokens instantly fail verification (middleware checks `token_version` against DB/cache) and all refresh tokens for that user are revoked.

**Suspicious session detection**
Flag and require step-up (OTP or re-login) when:
- New device/IP combination not seen in the last 90 days for that account.
- Impossible travel (two logins from geographically distant IPs within a time window shorter than plausible travel).
- More than N concurrent active sessions for a single account (tune N; e.g., 5).
- A refresh token is reused after rotation (see above — this is theft, not just "suspicious").
- Rapid password-reset requests or repeated failed logins (see Section 7-style rate limiting, applied here too: 5 failed attempts → 15-minute lockout + CAPTCHA, not permanent lockout, to avoid weaponized lockout-DoS against real users).

---

## 2. User Roles

### Plain English

There are three roles: **Candidate**, **Recruiter**, and **Admin**. A candidate should only ever see their own data and the specific recruiters/jobs they've matched with. A recruiter should only see candidates they've legitimately been shown through the matching system (or who matched with them) — never the entire candidate database. Admin is for SwipeHire's own team and should be small in number, logged heavily, and never used for day-to-day product access.

### CRUD / Access Matrix

| Resource | Candidate | Recruiter | Admin |
|---|---|---|---|
| Own profile | Read/Update/Delete (Create at signup) | — | Read (support only, logged) |
| Own resume file | Create/Read/Update/Delete | — | Read (support/abuse investigation only, logged) |
| Other candidates' profiles | **No access** | Read *only* profiles surfaced in their swipe deck or matched with them (limited fields pre-match, full post-match) | Read (investigation only) |
| Job listings (own company) | — | Create/Read/Update/Delete | Read |
| Job listings (other companies) | Read (public discovery fields only) | Read (public discovery fields only) | Read/Update (moderation) |
| Own company/recruiter profile | — | Create/Read/Update | Read/Update (verification) |
| Swipes (own) | Create/Read (own history) | Create/Read (own history) | Read (abuse investigation) |
| Swipes (others') | **No access** | **No access** | Read (abuse investigation) |
| Matches involving self | Read | Read | Read |
| Matches not involving self | **No access** | **No access** | Read (dispute/abuse investigation) |
| Chat messages (own matches) | Create/Read | Create/Read | Read (abuse report investigation only, logged, ideally with per-case approval) |
| Chat messages (others') | **No access** | **No access** | Restricted, case-linked access only |
| Interview scheduling (own match) | Read/Update (confirm slot) | Create/Read/Update (propose slot) | Read |
| Recruiter verification status | Read (own, if recruiter) | Read/Update (submit docs) | Read/Update (approve/reject) |
| Platform-wide user accounts | — | — | Read/Update (suspend, ban) — never raw password/token access |
| Reported content/abuse queue | Create (file a report) | Create (file a report) | Read/Update (resolve) |

**Explicitly cannot access, regardless of role:**
- No role can query raw password hashes, refresh token values, or full session tables through the application API — those exist only in the auth service's internal storage.
- No candidate can see who swiped left on them, or the fact that a swipe happened at all before a match.
- No recruiter can see a candidate's activity on *other* companies' job listings.
- Admins cannot casually browse chats or resumes outside an active support/abuse case — access should require a case/ticket reference and is audit-logged (see Section 12).

---

## 3. Authorization

### Plain English

Roles alone aren't enough — "recruiter" isn't a single blob of permission, it's "this specific recruiter, for this specific company, for this specific job." Authorization has to check **ownership**, not just role, on every request that touches a specific record. This is the single most common place hiring/marketplace apps get breached: someone changes an ID in the URL (`/api/candidates/1234` → `/api/candidates/1235`) and gets someone else's data because the server checked "are you a recruiter?" but not "is this *your* candidate match?"

### Implementation

- **Every** mutating/reading endpoint that takes a resource ID must run an ownership/relationship check server-side before returning data — never trust a client-supplied ID as sufficient authorization on its own.
- Use an attribute-based access control layer (e.g., **CASL** in NestJS) on top of route guards, so rules like "a recruiter can read a candidate profile only if a match exists between them, or if the candidate appears in an active, unfiltered result of their own job's swipe deck" are defined once, centrally, and reused — not copy-pasted per controller.
- Concretely, at minimum:
  - `GET /profiles/:id` — allowed only if `id === requester.id`, OR a match row exists linking requester (recruiter) to that candidate, OR requester is admin with a case reference.
  - `PATCH /profiles/:id` — allowed only if `id === requester.id`. No role can ever update another user's profile, including admins (admins suspend/flag, they don't edit user content).
  - `GET /jobs/:id/candidates` — allowed only if `requester.id === job.recruiter_id` (or requester belongs to the same verified company as the job owner, if multi-recruiter companies are supported).
  - `GET /matches/:id` — allowed only if `requester.id IN (match.candidate_id, match.recruiter_id)`.
  - `GET /chat/:matchId/messages` — allowed only if requester is a participant of that match AND the match status is `active` (not blocked/archived-with-no-history-access, per Section 9).
  - Company-scoped recruiter data (e.g., a second recruiter at the same company viewing a colleague's job pipeline) requires an explicit `company_id` membership check, not just "same role."
- Return `404`, not `403`, for resources that exist but the requester has no relationship to (Section 11) — a `403` on a guessed ID confirms the ID exists, which is itself an information leak in a system with sequential or guessable IDs. Use non-sequential IDs (UUIDv7 or ULID) for all resource identifiers regardless.
- Admin actions are further gated by a **second permission layer** (admin scopes: `support.read`, `verification.approve`, `abuse.moderate`, `billing.manage`) — not all admins get all admin powers.

---

## 4. Database-Level Security

### Plain English

Even if a bug in the application code forgets an authorization check, the database itself should refuse to hand back rows the connected user isn't allowed to see. This is a second, independent layer of defense — "defense in depth" — so a single mistake in one controller doesn't turn into a full data breach.

### Implementation

Enable **PostgreSQL Row-Level Security (RLS)** on all tables containing user, profile, job, swipe, match, and message data.

- The application sets a session variable per request (right after acquiring a DB connection, before running any query): `SET LOCAL app.current_user_id = '<uuid>'; SET LOCAL app.current_role = 'candidate';`
- Every table has policies that reference these session variables, so even a raw/forgotten `SELECT *` in application code is constrained by Postgres itself.

Example policies (illustrative, not exhaustive):

```sql
-- Profiles: a user can always read their own row.
CREATE POLICY profile_self_read ON profiles
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Profiles: a recruiter can read a candidate profile only if a match exists.
CREATE POLICY profile_recruiter_match_read ON profiles
  FOR SELECT
  USING (
    current_setting('app.current_role') = 'recruiter'
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.candidate_id = profiles.user_id
        AND m.recruiter_id = current_setting('app.current_user_id')::uuid
    )
  );

-- Matches: only the two participants can see a match row.
CREATE POLICY match_participant_read ON matches
  FOR SELECT
  USING (
    candidate_id = current_setting('app.current_user_id')::uuid
    OR recruiter_id = current_setting('app.current_user_id')::uuid
  );

-- Messages: only match participants, and only while the match is not hard-deleted.
CREATE POLICY message_participant_read ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.candidate_id = current_setting('app.current_user_id')::uuid
             OR m.recruiter_id = current_setting('app.current_user_id')::uuid)
    )
  );

-- Jobs: only the owning recruiter (or same verified company) can write.
CREATE POLICY job_owner_write ON jobs
  FOR UPDATE
  USING (recruiter_id = current_setting('app.current_user_id')::uuid);
```

- The application's DB connection role itself should **not** be a Postgres superuser or table owner in production — use a least-privilege role that can only `SELECT/INSERT/UPDATE/DELETE` through RLS, with `BYPASSRLS` explicitly denied.
- A separate, more restricted DB role (or read replica) is used for analytics/BI so ad-hoc reporting queries can't accidentally dump unfiltered PII.
- Background workers (resume parsing, notification dispatch) connect with their own scoped role — a resume-parsing worker needs `SELECT` on `profiles.resume_url` and `UPDATE` on `profiles.parsed_json`, nothing else.
- Migrations and admin tooling that genuinely need to bypass RLS run through a dedicated, audited service account — never the app's normal runtime credentials.

---

## 5. Resume & File Security

### Plain English

Resumes are the most sensitive files on the platform — full name, contact details, employment history, sometimes salary. They should never sit in a public bucket, never be reachable by guessing a URL, and never be trusted blindly the moment they're uploaded (a resume upload field is also just a generic file-upload field to an attacker).

### Implementation

- **Storage:** Private S3 bucket, `Block Public Access` enabled at the bucket level (not just per-object), no bucket policy ever grants public read.
- **Encryption:** SSE-KMS with a customer-managed key (not the default AWS-managed key) so key usage/rotation is auditable and revocable independently of S3 itself. TLS enforced for all access (bucket policy denies non-HTTPS requests).
- **Upload flow:**
  1. Client requests a **pre-signed upload URL** from the API (server checks the requester is authenticated and owns the target profile).
  2. Pre-signed URL is scoped to a specific key (`resumes/{user_id}/{uuid}.pdf`), has a short TTL (60–120 seconds), and restricts `Content-Type` and `Content-Length` via the presigned POST policy — the client can't silently swap in an executable or an oversized file.
  3. On `s3:ObjectCreated`, a Lambda (or worker) runs **malware scanning** (e.g., AWS GuardDuty Malware Protection for S3, or ClamAV in a container) before the file is marked "usable." Until scanned clean, the file is not linked to the user's profile or servable.
  4. **File validation:** allow-list only `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; verify by magic bytes/content-sniffing server-side, not just the client-reported MIME type or extension. Max size (e.g., 5 MB). Reject anything else, including images unless explicitly supporting a "resume as image" path with OCR.
  5. Successful, clean scan → row updated (`profiles.resume_status = 'clean'`) → async NLP parsing worker picks it up.
- **Download/serving:** never a permanent public URL. Every view/download issues a fresh **pre-signed GET URL**, TTL 60–300 seconds, generated only after the authorization check in Section 3 (is this requester allowed to see this resume right now — self, or matched recruiter, or admin with case reference).
- **Access control on the object itself:** bucket policy additionally restricts by source (VPC endpoint / application role) as a second layer beyond application auth — belt and suspenders.
- **Deletion behavior:**
  - User-initiated delete or account deletion (Section 12) → S3 object is permanently deleted (not soft-deleted at the storage layer) within the retention window, and the DB row is either purged or tombstoned depending on legal/audit needs.
  - Superseded resumes (user uploads a new version) → old object deleted after a short grace period, not kept indefinitely.
  - S3 lifecycle policy as a backstop: hard-delete any object left in an "unscanned"/orphaned state for more than 24 hours (failed upload cleanup).

---

## 6. Privacy — What's Visible, When

### Plain English

The whole point of a swipe-based system is that people can be discovered without over-exposing themselves immediately. Full contact details and a complete resume shouldn't be sitting in front of every recruiter who scrolls past — that's how candidates get spammed and how the "double opt-in" trust model breaks.

### Visibility Rules

| Stage | Recruiter sees (about candidate) | Candidate sees (about recruiter/job) |
|---|---|---|
| **Pre-swipe (discovery)** | First name + last initial, headline/role, years of experience, city (not exact address), skill chips, match score, one highlight line. **No** phone, **no** email, **no** full resume, **no** last name. | Company name/logo, role title, salary band, location/remote tag, required-skill chips, "posted X days ago." **No** individual recruiter's personal contact info. |
| **After mutual match** | Full profile: full name, full resume (via short-TTL pre-signed URL), portfolio/GitHub links if provided. Email/phone are still **not auto-revealed** — exchanged only if either party chooses to share it inside chat, or via an explicit "share contact info" action that's logged and revocable. | Recruiter's professional identity (name, verified company), job's full detail, ability to chat. |
| **During interview scheduling** | Proposed/confirmed time slots only. Calendar sync (Section 0) shares free/busy or the specific event, never the candidate's or recruiter's full calendar contents. | Same — only the scheduling exchange, not either party's broader calendar. |
| **To other candidates** | N/A | Candidates never see other candidates, their swipes, or their match status — full isolation. |
| **To other recruiters (different company)** | Never see another company's candidate pipeline, swipe activity, or match list. | N/A |
| **To recruiters at the same company** | Configurable: either fully isolated per-recruiter pipelines, or shared visibility within the company if the company opts into team hiring — this must be an explicit setting, not a default, and is itself logged. | N/A |

- Match score and "why you were shown this" reasoning (Section 1.3 of the product spec) are shown to build trust, but the underlying feature weights/model internals are never exposed via API — only the final score and a short human-readable explanation.
- Blocking or unmatching immediately drops the other party back to "pre-match" visibility for any cached client-side data, and the server stops returning full-profile fields for that pair going forward.

---

## 7. Swipe Security

### Plain English

A swipe is a tiny, cheap action, which is exactly what makes it abusable — bots can swipe right on everyone to scrape data or spam-apply, and a network retry could accidentally send the same swipe twice. The system needs to make sure every swipe is real, from a real rate-limited human/account, and counted exactly once.

### Implementation

- **Rate limits** (tune based on real usage, enforced in Redis with a sliding-window counter per `user_id` and secondarily per IP):
  - Candidates: e.g., max 100 swipes/day (soft), with a CAPTCHA/step-up challenge past an even higher burst threshold (e.g., 30 in 2 minutes) that's clearly automated behavior.
  - Recruiters: a **per-job** daily right-swipe cap (per the product's "intentionality" design goal in the technical analysis) in addition to an account-level cap, since a single recruiter account swiping right on hundreds of candidates for one role in minutes is a strong bot/scrape signal.
  - All swipe endpoints sit behind a general API rate limiter (e.g., token bucket, ~10 req/sec/user) regardless of business-logic caps.
- **Idempotency:** client generates a UUID (`idempotency_key`) per swipe action at gesture-time. Server stores recently-seen idempotency keys in Redis (TTL ~24h); a repeated key with the same payload returns the original result without re-processing — protects against double-taps and client retry storms creating duplicate swipe rows or duplicate match checks.
- **Replay attack prevention:** swipe requests are authenticated (short-lived access token, Section 1) and additionally carry a request timestamp; requests older than a small window (e.g., 60 seconds) are rejected, so a captured request can't be resent later to fabricate history.
- **Duplicate swipe requests:** a unique constraint at the DB level on `(actor_id, target_id, target_type)` for swipes (upsert on conflict — a later swipe by the same user on the same target updates direction rather than inserting a new row), so "did they swipe left then right?" resolves to one current state, not a growing log that has to be de-duplicated at read time.
- **Bot/scraping defenses:**
  - Device attestation on mobile (App Attest on iOS, Play Integrity API on Android) to reduce emulator/scripted-client swiping.
  - No bulk-listing endpoint ever returns more than a small page of candidates/jobs per call, and pagination is cursor-based with per-request auth, not a raw offset that enables systematic full-database walks.
  - Anomaly detection on swipe velocity/pattern (e.g., swiping right on 100% of a deck with sub-200ms intervals) flags the account for review/step-up rather than silently allowing it.
  - WAF rules (AWS WAF) rate-limit and challenge traffic patterns typical of scraping (missing normal mobile headers, datacenter IP ranges hitting discovery endpoints at high volume).

---

## 8. Match Security

### Plain English

A "match" is the single most trust-sensitive event in the whole system — it's what unlocks chat and full profile visibility. It must only ever be created by the server, from two independently verified swipe events, never from a client simply asserting "we matched."

### Implementation

- **No client-created matches, ever.** There is no API endpoint that accepts a match object from the client. Matches are a *derived* result of the swipe pipeline (Section 2.4 of the technical analysis): a candidate's right-swipe and a recruiter's right-swipe on the same `(candidate, job)` pair, checked server-side.
- **Exactly-once creation:** the match-detection check and the match-insert happen inside a single database transaction with a **unique constraint** on `(candidate_id, job_id)` in the `matches` table. Even if two swipe events race each other (both sides swipe within milliseconds), the DB constraint guarantees only one match row is ever created — the second attempted insert fails harmlessly and is treated as "match already exists," not an error surfaced to the user.
- **Redis as an accelerator, Postgres as the source of truth:** Redis is used for the fast O(1) "did the other side already swipe right?" check for responsive UX, but the actual match record and its authorization decisions are always backed by the Postgres row — Redis being flushed or inconsistent should never be able to fabricate or hide a match; a reconciliation job periodically verifies Redis pending-swipe state against Postgres.
- **Forged match request prevention:** because matches aren't client-submittable and swipes are authenticated + idempotent + rate-limited (Section 7), there's no path for a client to force a match without actually performing two real, authorized swipe actions from two real accounts.
- **Access to someone else's match:** covered by Section 3 (ownership check) and Section 4 (RLS) — both layers independently block `GET /matches/:id` unless the requester is a participant.
- **Un-matching:** either party can end a match. This sets `matches.status = 'unmatched'` (not a hard delete, to preserve abuse-investigation trail per Section 12/13), immediately revokes chat access (Section 9), and both sides return to pre-match visibility (Section 6).

---

## 9. Chat Security

### Plain English

Chat is where the most sensitive back-and-forth happens — negotiation, personal details, interview logistics. Only the two matched people should ever be able to read it, and that has to be enforced on every single message, not just when the chat screen first opens.

### Implementation

- **Who can initiate chat:** only after a match exists and its status is `active` (Section 8). Neither party can message someone they haven't matched with — there is no "cold message" feature in this design.
- **Who can read messages:** enforced at three points —
  1. **Socket.io connection:** on connect, the server verifies the access token and only allows the client to `join` a room named by `match_id` if the token's `sub` is a participant in that match (checked against Postgres, cached briefly in Redis).
  2. **REST history endpoint** (`GET /chat/:matchId/messages`, for initial load/pagination): same ownership check as Section 3, backed by RLS as in Section 4.
  3. **Message send:** server re-validates match participancy and `status = 'active'` on every `send` event, not just at connection time — a match could be unmatched/blocked mid-session, and the socket must respect that immediately (server force-closes the room membership on unmatch/block).
- **Message storage:** persisted in Postgres (or a dedicated store, per the technical analysis) keyed by `match_id`, encrypted at rest via the database's standard encryption; message bodies are never logged in plaintext in application logs (log the event/metadata, not the content).
- **Abuse reporting:** either party can report a match/conversation, which snapshots the recent message history into an admin-visible case (Section 12's audited-access model applies — investigators need a case reference to view it).
- **Blocking:** blocking immediately ends the match's chat access (same mechanism as unmatch) and additionally prevents the blocked party from being surfaced to the blocker again in future swipe decks.
- **Rate limiting:** message send is rate-limited per user per match (e.g., a burst cap) to prevent chat spam/flooding, independent of the swipe rate limits.
- **Notification privacy:** push notifications for new messages show a generic string ("New message from a match") rather than the message content on the lock screen, since lock-screen notifications are visible to anyone holding the phone. Full content loads only inside the authenticated app session.

---

## 10. Recruiter Verification

### Plain English

Fake recruiter accounts posting fake jobs are a real problem in the Indian job market specifically, and they're also how a lot of resume-harvesting scams work. Before someone can post a job or swipe on candidates, SwipeHire needs reasonable confidence they're a real recruiter at a real company.

### Implementation

Tiered verification, increasing in trust:

1. **Company email domain verification (baseline, required to post any job):** recruiter signs up with a work email; the platform sends a verification link/OTP to that address. The domain is checked against a maintained block-list of free/public email providers (Gmail, Yahoo, Outlook.com, disposable-email domains) — a `@gmail.com` address alone does not qualify as "company email" and triggers the manual path instead.
2. **Business verification (required before "Verified Company" badge and before higher swipe/posting limits):** upload of business registration proof (e.g., GST certificate/Certificate of Incorporation for India), cross-checked against a business registry lookup where feasible, and domain-to-company-name consistency check (does the email domain plausibly match the claimed company?).
3. **Manual admin review** for anything ambiguous: mismatched domain/company name, newly-registered domains, business documents that fail automated checks, or accounts flagged by the fraud-signal system (Section 13). Reviewed by a scoped `verification.approve` admin (Section 3), decision and reviewer ID logged.
- Until at least step 1 passes, a recruiter account can browse/set up a profile but **cannot** post live job listings or appear in candidate swipe decks — this caps the damage an unverified/fake account can do while still allowing normal signup friction to stay low.
- Verification status is a first-class, candidate-visible signal (a badge), and job listings from unverified recruiters can be deprioritized or excluded from candidate discovery by default.
- Re-verification is triggered if a verified recruiter's email domain changes, or after a sustained pattern of candidate reports (Section 13).

---

## 11. Error Handling

### Plain English

Error messages are one of the easiest ways to accidentally leak internal information — a stack trace, a SQL error, or even just "email not found" vs. "wrong password" tells an attacker things they shouldn't know. Every error the client sees should be generic and safe; the real detail goes into internal logs only, tied to a request ID a user can quote to support if needed.

### Implementation

Standard error envelope for every API error:
```json
{ "error": { "code": "AUTH_INVALID_CREDENTIALS", "message": "Invalid email or password.", "requestId": "req_9fa2..." } }
```

| Scenario | Client-facing behavior | Internal handling |
|---|---|---|
| Invalid login | Generic "Invalid email or password" for both "no such user" and "wrong password" — never distinguish. Failed attempts counted for lockout (Section 1). | Log attempt (hashed/partial identifier, IP, timestamp) for abuse monitoring. |
| Expired access token | `401` with `code: TOKEN_EXPIRED`; client silently attempts refresh-token exchange before re-prompting login. | Standard JWT `exp` check in middleware. |
| Unauthorized access (wrong owner/role) | `404 Not Found` for resource-not-yours (Section 3's information-leak reasoning); `403 Forbidden` only where existence is already public (e.g., trying to edit someone else's public job listing). | Log with requester ID + resource ID for anomaly detection (repeated 404/403 probing = scraping/IDOR attempt). |
| Invalid input | `400` with field-level validation errors (safe to be specific here — it's about the user's own input, not someone else's data). Server-side validation (e.g., `class-validator` in NestJS) always re-checked even if client also validates. | — |
| Failed payment (if introduced later) | Generic "Payment could not be processed, please try again or use a different method." Never surface raw payment-gateway error text. | Full gateway response logged internally, tied to `requestId`, for support/finance follow-up. |
| Failed resume upload | "Upload failed, please try again." If rejected for type/size, a specific safe message ("File must be a PDF or Word document under 5MB"). If malware-scan flagged, generic "This file couldn't be processed" — never confirm "malware detected" to the uploader. | Quarantine + internal alert on malware-scan hits. |
| Failed parsing (NLP/resume) | Profile shows "We couldn't auto-fill your profile — please review and fill manually," not a raw parser exception. | Retry with backoff; after N failures, route to manual-fill flow and log for parser-quality tracking. |
| Failed matching | Silent retry/reconciliation (Section 8); user never sees a "matching failed" error for a normal swipe — worst case, the match appears slightly delayed after a background reconciliation pass. | Alert if reconciliation backlog grows, indicating a pipeline issue. |
| Failed chat delivery | Client shows a local "not delivered, tap to retry" indicator per message (standard messaging-app UX); message is queued client-side and retried. | Server acks only after durable write; client distinguishes "sent to server" vs "delivered." |
| Database failure | `503 Service Unavailable` with `Retry-After` header, generic "Something went wrong, please try again shortly." | Circuit breaker trips after N consecutive failures to avoid hammering a struggling DB; paged to on-call. |
| Service timeout | Same `503`/generic pattern; timeouts are bounded (e.g., 5s per downstream call) so one slow dependency doesn't cascade. | Distributed tracing (request ID propagated) to identify which hop timed out. |

**Golden rule:** stack traces, SQL text, internal hostnames, library versions, and file paths never appear in any client-facing response, in any environment reachable by real users (including staging, if it's internet-reachable).

---

## 12. Data Protection & Compliance (India-focused, DPDP Act 2023)

### Plain English

India's Digital Personal Data Protection Act treats SwipeHire as a **Data Fiduciary** handling candidates' and recruiters' **personal data** — meaning there are specific legal obligations, not just good practice: get clear consent, don't keep data longer than needed, let people actually delete their data (not just hide it), and be able to prove all of this if asked.

### Implementation

- **Consent:** explicit, itemized consent at signup — not a single bundled "I agree to everything" checkbox. Separate, clear notices for: (a) core account/profile data processing, (b) resume parsing via NLP, (c) sharing profile data with matched recruiters, (d) marketing/notification communications (opt-in, separately revocable). Consent state and timestamp are stored and versioned against the specific privacy notice text shown.
- **Data retention:**
  | Data type | Retention |
  |---|---|
  | Active account data | Retained while account is active |
  | Resume files | Retained while account active; deleted per account/resume deletion rules below |
  | Swipe history | Retained for matching/product function while active; anonymized/aggregated after ~12–24 months for accounts with no activity, rather than kept identifiable indefinitely |
  | Chat messages | Retained while the match exists; purged on hard account deletion (subject to abuse-investigation holds, see below) |
  | Deleted-account data | Soft-deleted with a short grace period (e.g., 30 days, to allow accidental-deletion recovery), then hard-purged from primary stores and backups on their normal rotation schedule |
  | Audit/security logs | Retained separately for a defined period (e.g., 12 months) for security investigation purposes — this is a narrower, access-controlled dataset, not the user-facing product data |
- **Data deletion / right to erasure:**
  - Account deletion request → grace-period soft delete → automated job hard-deletes: Postgres rows (or anonymizes rows needed for referential integrity, e.g., a match record might keep an anonymized placeholder if the other party's data must remain consistent), S3 resume objects, and any derived/cached copies (search index, Redis cache, CDN cache invalidation).
  - Resume-specific deletion (without full account deletion) is a distinct, always-available action — deletes the S3 object and clears `parsed_json`/`resume_url`.
  - A deletion request that conflicts with an active legal hold (e.g., an open abuse investigation involving that account) is handled per policy — data relevant to the investigation is retained in the restricted security-log store, not the live product database, and the user is informed of the limited exception.
- **Data minimization:** collect only what's needed for the hiring function — no unnecessary fields (e.g., no requirement for government ID numbers, marital status, or other data with no product purpose). Discovery-stage cards (Section 6) already reflect minimization by design (no contact info pre-match).
- **Grievance/DPO contact:** DPDP Act requires a designated contact for data-principal grievances — publish a Grievance Officer contact and a defined response SLA (e.g., acknowledge within 48 hours, resolve within 30 days).
- **Cross-border transfer:** DPDP permits transfer except to countries the government notifies as restricted — if using AWS regions/sub-processors outside India, keep an up-to-date sub-processor list and confirm no restricted-country routing; prefer an `ap-south-1` (Mumbai) primary region for Indian user data where practical.
- **Breach notification:** maintain an incident response runbook with defined severity tiers and a notification path to the Data Protection Board and affected users as required by the Act's timelines once specific rules are notified — don't wait for an incident to design this process.
- **Audit logs:** every access to a resume, full profile, or chat content by an admin/support account is logged (`who, what record, when, case reference`) and periodically reviewed — this is what makes Section 2's "admin access is logged" claim actually verifiable rather than aspirational.

---

## 13. Abuse & Moderation

### Plain English

Any two-sided marketplace attracts fake accounts, spam, and scams — fake recruiters trying to harvest resumes, fake candidate profiles, harassment in chat. SwipeHire needs both automated signals to catch obvious patterns early and a clear human process for the rest.

### Implementation

| Threat | Detection | Response |
|---|---|---|
| Fake candidate profiles | Heuristics: disposable email domains, no resume + minimal profile + high swipe velocity, duplicate profile content across accounts | Shadow-limit visibility pending review; require additional verification (OTP/email) before full discovery access |
| Fake job listings | Duplicate-content detection against existing listings, anomaly scoring on description text (reusing the NLP pipeline already planned for resume parsing), salary/requirement inconsistency checks, unverified-recruiter deprioritization (Section 10) | Auto-flag for admin review; hold from candidate discovery until reviewed if score exceeds threshold |
| Harassment in chat | User reports (Section 9), plus lightweight automated content signals (repeated flagged keywords/patterns) as a *supplement* to reports, not a replacement — avoid over-relying on automated text moderation for nuanced harassment | Case created for admin review with message-history snapshot (audit-logged access, Section 12); actions range from warning to suspension to ban |
| Spam (chat or listings) | Rate limits (Sections 7 & 9) as first line; pattern detection (identical message sent to many matches in a short window) | Throttle/mute; repeated pattern → suspension |
| Malicious uploads | Malware scanning on every file (Section 5); type/size validation | Quarantine, never store or serve; alert security if pattern suggests targeted probing |
| Fraudulent recruiters | Verification tiering (Section 10) + candidate reports + business-document mismatch signals | Suspend job-posting ability pending re-verification; ban on confirmed fraud |
| Suspicious activity generally | Centralized signal aggregation (login anomalies from Section 1, swipe anomalies from Section 7, report volume) feeding an admin-facing risk queue rather than scattered ad-hoc checks | Tiered response: soft friction (CAPTCHA/step-up) → feature restriction → suspension → ban, proportionate to severity/confidence |

- All moderation actions (warn, restrict, suspend, ban) are logged with the acting admin, reason, and evidence reference — both for accountability and because users may dispute the action.
- A basic appeals path exists for suspended/banned accounts (a form or support channel), reviewed by an admin other than the one who took the original action where feasible.

---

## 14. Pre-Production Security Checklist

**Authentication**
- [ ] Argon2id password hashing, breach-list check at signup
- [ ] Google + Apple OAuth implemented and `email_verified` checked
- [ ] JWT access tokens (RS256, 15-min expiry), opaque rotating refresh tokens (30-day)
- [ ] Refresh-token reuse detection revokes the full token family
- [ ] Logout revokes refresh token; "log out all devices" bumps `token_version`
- [ ] OTP flow for password reset and recruiter email verification, 5-min TTL
- [ ] Login lockout after repeated failures (temporary, with CAPTCHA, not permanent)

**Authorization**
- [ ] Every resource-ID endpoint performs an ownership/relationship check server-side
- [ ] Centralized ability/policy layer (e.g., CASL) rather than per-controller ad hoc checks
- [ ] 404-not-403 pattern applied for not-your-resource cases
- [ ] Non-sequential (UUID/ULID) resource IDs everywhere

**API Security**
- [ ] Rate limiting on all endpoints, stricter limits on auth and swipe endpoints
- [ ] Input validation on every endpoint (server-side, not just client)
- [ ] Standardized, non-leaky error envelope (Section 11)
- [ ] CORS locked to known app origins; no wildcard in production
- [ ] Security headers set (HSTS, CSP where applicable, X-Content-Type-Options, etc.)

**Database Security**
- [ ] Row-Level Security enabled and tested on all sensitive tables
- [ ] App DB role is least-privilege, `BYPASSRLS` denied
- [ ] Separate scoped roles for background workers and analytics/BI
- [ ] Unique constraints enforced for swipe/match dedup at the DB layer, not just app logic

**Storage Security**
- [ ] S3 buckets private, Block Public Access on, SSE-KMS with customer-managed key
- [ ] Pre-signed URLs short-TTL for both upload and download
- [ ] Malware scanning wired into the upload pipeline before files are usable
- [ ] File type/size validated by content-sniffing, not extension/MIME header alone
- [ ] Deletion actually removes S3 objects, not just DB rows

**Network Security**
- [ ] TLS 1.2+ enforced everywhere, including internal service-to-service calls
- [ ] WAF rules for common attack patterns and scraping signatures
- [ ] Private subnets for DB/Redis; no direct public internet access to data stores

**Secrets**
- [ ] No secrets in source control (scanned via pre-commit/CI secret scanning)
- [ ] Secrets in a managed secrets store (AWS Secrets Manager/Parameter Store), rotated periodically
- [ ] Separate credentials per environment (dev/staging/prod never share secrets)

**Logging & Monitoring**
- [ ] Structured logs with request IDs; no PII or message content in plaintext logs
- [ ] Admin access to sensitive records is audit-logged with case references
- [ ] Alerting on auth anomalies, error-rate spikes, and reconciliation backlogs

**Rate Limiting**
- [ ] Global per-IP and per-user limits at the gateway
- [ ] Business-logic limits on swipes (per-account and per-job for recruiters)
- [ ] Chat message send limits per match

**File Uploads**
- [ ] Resume upload restricted to allow-listed types, size-capped, scanned before use
- [ ] Presigned POST policy constrains content-type/length client-side too (defense in depth)

**Privacy**
- [ ] Discovery-stage fields match Section 6's pre-match minimization exactly
- [ ] Contact info never auto-revealed on match without explicit user action
- [ ] Consent capture itemized and versioned; deletion actually cascades (Section 12)

**Data Deletion**
- [ ] Account deletion pipeline tested end-to-end (grace period → hard purge, including S3 and caches)
- [ ] Resume-only deletion available independent of full account deletion
- [ ] Legal-hold exception path defined and documented

**Penetration Testing**
- [ ] Pre-launch external penetration test covering auth, IDOR/authorization, file upload, and chat access-control paths specifically (these are this product's highest-risk surfaces)
- [ ] Re-test after any major change to auth, matching, or chat systems
- [ ] Findings tracked to closure before public launch, not just before "code freeze"

---

*This document defines the security and access model for SwipeHire's MVP and initial production launch. It should be revisited whenever the architecture changes materially (new services, new data types, multi-recruiter company accounts, payments) and re-reviewed against DPDP Act rules as they are formally notified.*
