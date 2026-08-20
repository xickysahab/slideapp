# SwipeHire — Backend Reference

Everything the API does, as built. This is the contract the mobile app is written against.

Taken from the running server's route table and the live database schema, not from memory — if
something here disagrees with the code, the code is right and this file needs fixing.

Companion documents: `Architecture.md` for why the system is shaped this way, `Security.md` for what
is and is not defended, `Frontend.md` for how the client consumes all of this.

- **Base URL (local):** `http://localhost:3000`
- **Base URL (deployed):** the Render service URL — kept out of this repo, see `RENDER-ENV.txt`
- **All feature endpoints:** prefixed `/api`
- **Health checks:** `/health` and `/health/ready`, deliberately outside the prefix
- **Realtime:** Socket.io at `/realtime`

---

## 1. Running it

```bash
cd swipehire-api
cp .env.example .env      # fill in DATABASE_URL, JWT secrets, Supabase keys
npm install
npm run migration:run     # creates the schema
npm run seed              # 18 jobs, 18 candidates, a primed match
npm run start:dev
```

| Script | What it does |
|---|---|
| `npm run start:dev` | Dev server, watch mode |
| `npm run build` | Compiles to `dist/` |
| `npm test` | Unit tests — skill matching, match scoring |
| `npm run seed` | Wipes and rebuilds demo data |
| `npm run migration:run` | Applies pending migrations |
| `npm run migration:revert` | Rolls back the last one |
| `npm run verify:auth` | 21 checks, needs the server running |
| `npm run verify:profile` | 23 checks |
| `npm run verify:jobs` | 29 checks |
| `npm run verify:loop` | 39 checks — the whole journey, including sockets |
| `npm run verify:storage` | 6 checks — signed upload/download round trip |

The verify scripts drive real HTTP against real storage and a real database, then clean up after
themselves. They are the fastest way to find out whether something is broken.

---

## 2. Auth model

**Access token** — JWT, 15 minutes, sent as `Authorization: Bearer <token>`.
**Refresh token** — JWT, 30 days, stored server-side as a SHA-256 hash so logout can actually
revoke it. Signed with a *different* secret from the access token.

Both are signed **HS256** with a shared secret, not RS256 as the full spec calls for. For a single
service that both signs and verifies, the practical difference is nil; it becomes a real gap the
moment a second service has to validate a token without being able to mint one. See
`Architecture.md` §6.

The refresh token is hashed with SHA-256 rather than Argon2 on purpose — it is a 300-bit random
value, not a human-chosen password, so there is no guessable keyspace to slow an attacker through,
and refresh runs on every app foreground.

Every authenticated request re-reads the user from the database rather than trusting the token's
claims. It costs one indexed lookup, and it means a deleted account loses access immediately rather
than up to fifteen minutes later, and a stale token can't assert a role the user no longer holds.

Rotation-on-refresh and reuse detection are deliberately not implemented (Demo Security Baseline
§1 defers both).

### Roles

`candidate` | `recruiter`, fixed at signup and never changeable by the client.

Role determines what half of the product you see. There is no admin role in this build.

---

## 3. API reference

Every endpoint below requires `Authorization: Bearer <accessToken>` unless marked **public**.

Validation runs with `whitelist` and `forbidNonWhitelisted`, so **any field not listed in a request
body is a 400**, not silently ignored. That is intentional — it surfaces client/server drift early.

### 3.1 Auth — `/api/auth`

#### `POST /auth/signup` · public · → 201

```jsonc
// request
{ "email": "aditi@example.com", "password": "min-8-chars", "role": "candidate" }

// response
{
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…",
  "user": { "id": "uuid", "email": "aditi@example.com", "role": "candidate" }
}
```

`409` if the email is taken. Password must be 8–72 characters.

#### `POST /auth/login` · public · → 200

```jsonc
{ "email": "aditi@example.com", "password": "…" }
```

Same response shape as signup. **`401` with the identical message for both a wrong password and an
unknown address** — and the server spends the same time on both, so the two cases can't be told
apart by timing either.

#### `POST /auth/refresh` · public · → 200

```jsonc
{ "refreshToken": "eyJ…" }
// → { "accessToken": "eyJ…", "refreshToken": "eyJ…" }
```

The refresh token comes back unchanged (no rotation). `401` if it's expired, revoked, or unknown.

#### `POST /auth/logout` · public · → 204

```jsonc
{ "refreshToken": "eyJ…" }
```

Revokes that one session. Idempotent — logging out twice is not an error. Unauthenticated on
purpose: someone holding a valid refresh token should be able to kill it even after their access
token expired.

#### `GET /auth/me` → 200

```jsonc
{ "id": "uuid", "email": "…", "role": "candidate" }
```

Use on app launch to check a stored token is still good and recover the user's role.

#### `POST /auth/google` · public · → 200

```jsonc
{ "idToken": "<google id token>", "role": "candidate" }  // role only needed first time
// → { accessToken, refreshToken, user, isNewUser }
```

**Implemented but not wired into the client.** Returns `503` because `GOOGLE_OAUTH_CLIENT_ID` is
unset. Google's flow needs a redirect scheme Expo Go can't provide, so enabling it means moving to
EAS dev builds. Email/password satisfies the PRD on its own.

---

### 3.2 Profile — `/api/profile`

#### `GET /profile/me` → 200

Shape depends on role:

```jsonc
// candidate
{
  "role": "candidate",
  "profile":   { "userId", "fullName", "avatarUrl", "locationCity", "createdAt" },
  "candidate": {
    "userId", "headline", "currentTitle", "yearsExperience",
    "skills": ["Node.js", "Postgres"],
    "resumeS3Key", "expectedSalaryMin", "expectedSalaryMax",
    "preferredWorkMode", "noticePeriodDays"
  }
}

// recruiter
{
  "role": "recruiter",
  "profile": { … },
  "company": { "id", "name", "logoUrl", "industry", "verified" }   // null before setup
}
```

#### `PATCH /profile` → 200

All fields optional. Returns the same shape as `GET /profile/me`.

```jsonc
{
  // both roles
  "fullName": "Aditi Kulkarni",
  "locationCity": "Bengaluru",
  "avatarUrl": "https://…",          // must include protocol

  // candidate only — a recruiter sending these gets 403 naming them
  "headline": "Payments and ledger systems",
  "currentTitle": "Senior Backend Engineer",
  "yearsExperience": 5,              // 0–60
  "skills": ["Node.js", "Postgres"], // max 50
  "expectedSalaryMin": 1800000,      // annual rupees
  "expectedSalaryMax": 2800000,
  "preferredWorkMode": "remote",     // remote | hybrid | onsite
  "noticePeriodDays": 60             // 0–180
}
```

Notes that matter for the UI:

- **`fullName` is required on the very first write** — 400 otherwise, since the column is NOT NULL.
- **Partial updates don't wipe untouched fields.** Sending only `locationCity` keeps everything else.
- **`skills` is replaced wholesale, not merged.** This is deliberate: the review-and-edit screen
  exists so a user can *remove* a wrongly-parsed skill, and merging would make removal impossible.
- `expectedSalaryMin > expectedSalaryMax` → 400.

#### `PUT /profile/company` · recruiter only · → 200

```jsonc
{ "name": "Razorpay", "logoUrl": "https://…", "industry": "Fintech" }
// → { "id", "name", "logoUrl", "industry", "verified": true }
```

Creates on first call, updates thereafter — a recruiter has exactly one company, so it's idempotent.
The company is resolved from the caller's own record; **the request never names a company id**.

`verified` is always `true` and is not settable by the client (recruiter verification is out of
scope; the badge still renders). A candidate calling this gets 403.

---

### 3.3 Resume — `/api/resume` · candidate only

Upload is a two-step handshake. The PDF never passes through the API process.

#### `POST /resume/upload-url` → 200

```jsonc
{ "uploadUrl": "https://…supabase.co/storage/v1/object/upload/sign/resumes/…?token=…",
  "key": "<userId>/<uuid>.pdf" }
```

Then the client does the upload itself:

```
PUT <uploadUrl>
Content-Type: application/pdf
<file bytes>
```

#### `POST /resume/parse` → 200

```jsonc
{ "key": "<userId>/<uuid>.pdf" }
// → { "skills": ["Node.js", "Postgres", …], "textLength": 710, "resumeKey": "…" }
```

Downloads the object, checks it really is a PDF by reading its first bytes, extracts the text, and
matches it against a ~90-entry skill taxonomy. Matched skills are **written straight onto the
candidate profile**, so `GET /profile/me` reflects them immediately.

| Situation | Response |
|---|---|
| Not actually a PDF (magic bytes) | `400` "That file is not a PDF" |
| PDF won't parse | `422` "That PDF couldn't be read…" |
| PDF has no selectable text (scanned) | `422` with its own message — *not* "no skills found" |
| Key belongs to someone else | `404` |
| Key isn't the shape we issue | `400` |
| No skills matched | `200` with `skills: []` — the review screen lets them add by hand |

Replacing a resume deletes the previous object.

#### `GET /resume/download-url` → 200

```jsonc
{ "url": "https://…?token=…" }   // 5-minute expiry
```

`404` if nothing uploaded.

#### `DELETE /resume` → 204

Deletes the stored file, not just the reference. **Keeps the skills** — the user may have edited
them by hand, and emptying their profile because they removed a file would be a surprise.

---

### 3.4 Jobs — `/api/jobs` · recruiter writes, both read

#### `POST /jobs` · recruiter only · → 201

```jsonc
{
  "title": "Senior Backend Engineer",      // 3–120 chars
  "description": "Own the ledger service…", // optional, ≤5000
  "techStack": ["Node.js", "Postgres"],     // 1–30 entries, required
  "compMin": 1800000,                       // optional
  "compMax": 2800000,
  "locationCity": "Bengaluru",
  "workMode": "remote",
  "experienceMinYears": 4                   // 0–40
}
```

Posted under the caller's own company, resolved server-side. **`companyId` and `recruiterId` are not
accepted in the body** — accepting either would let a recruiter post under someone else's company.

`404` with a clear message if they haven't set up a company yet. `techStack` must have at least one
entry, because it's what the match score is computed against.

#### `GET /jobs/mine` · recruiter only · → 200

**This is the recruiter dashboard.** Their own listings, newest first, each with its company object.
Includes `filled` jobs — they leave candidate decks but stay on the dashboard.

#### `GET /jobs/:id` → 200

Anyone signed in. Candidates only see `active` jobs — a filled one is `404` for them but visible to
its owner. **`recruiterId` is stripped for non-owners**: which account posted a listing isn't a
candidate's business pre-match.

#### `PATCH /jobs/:id` · owner only · → 200

Same fields as create, all optional. Another recruiter gets `404`, not `403`.

#### `PATCH /jobs/:id/status` · owner only · → 200

```jsonc
{ "status": "filled" }   // active | filled
```

Separate from `PATCH /jobs/:id` so closing a listing is an explicit act, not a stray field. There is
no delete — `filled` is a real business state.

---

### 3.5 Discovery — `/api/discover`

Both decks return cards already scored and ranked, best match first.

#### `GET /discover/jobs?cursor=` · candidate only · → 200

```jsonc
{
  "items": [{
    "id", "title", "companyName", "companyLogoUrl", "companyVerified",
    "locationCity", "workMode", "compMin", "compMax", "experienceMinYears",
    "techStack": ["Node.js", "Postgres", "AWS"],
    "description", "postedAt",
    "matchScore": 91,
    "matchedSkills": ["Node.js", "Postgres"]   // subset of techStack this candidate has
  }],
  "nextCursor": "MjA" // null when exhausted
}
```

Excludes anything already swiped (either direction — a pass is permanent) and anything not `active`.

#### `GET /discover/candidates?jobId=<uuid>&cursor=` · recruiter only · → 200

```jsonc
{
  "items": [{
    "id",
    "firstName": "Aditi",
    "lastInitial": "K",
    "currentTitle", "headline", "yearsExperience",
    "locationCity": null,          // withheld pre-match
    "preferredWorkMode",
    "skills": [...],
    "matchedSkills": [...],
    "hasResume": true,             // boolean only — no key, no URL
    "matchScore": 92
  }],
  "nextCursor": null
}
```

**Blind-first, enforced here rather than in the client.** No surname, no email, no phone, no resume
key ever enters this payload. Hiding those in the UI while the API returns them would undercut the
exact story the product is telling, so they never get serialized.

Scoped to one listing, and only a listing the caller owns — otherwise `404`. Swipes are tracked per
listing, so passing on someone for one job doesn't remove them from another.

Candidates who haven't finished onboarding (no name or no skills) are filtered out — an empty card
reads as a bug, not as an honest blank.

---

### 3.6 Swipes — `/api/swipes`

#### `POST /swipes` → 200

```jsonc
// candidate swiping a job
{ "targetId": "<jobId>", "targetType": "job", "direction": "right" }

// recruiter swiping a candidate, for one of their listings
{ "targetId": "<candidateUserId>", "targetType": "candidate", "direction": "right",
  "jobId": "<jobId>" }

// response
{ "recorded": true, "matched": true, "matchId": "uuid" }
```

- Candidates may only swipe `job`, and must **not** send `jobId` — the target is the job.
- Recruiters may only swipe `candidate`, and **must** send `jobId`.
- Idempotent: re-swiping the same pair updates the direction rather than duplicating.
- **`direction: "left"` never triggers a match check.** It's a pure "don't show again" signal —
  silent, permanent, and never notified to the other party.

A match is created only when both sides have right-swiped the same pairing. `matched` is `false`
otherwise, including on the first of the two swipes.

---

### 3.7 Matches — `/api/matches`

#### `GET /matches` → 200

```jsonc
[{
  "id": "uuid",
  "status": "active",            // active | archived | closed
  "matchScore": 100,
  "matchedAt": "2026-08-20T…",
  "job": { "id", "title", "companyName" },
  "counterparty": { "id", "name": "Rahul Mehta" },   // full name — post-match
  "lastMessage": { "content", "sentAt", "fromMe": false } | null,
  "unreadCount": 1,
  "outcomeNote": null
}]
```

Both roles, newest first. Contact details never appear here even post-match — the full spec makes
contact sharing an explicit, revocable act rather than an automatic consequence of matching.

#### `GET /matches/:id` → 200

The match with its job and company. **`404` for anyone who isn't a participant** — indistinguishable
from a match that doesn't exist.

#### `PATCH /matches/:id/outcome` · recruiter only · → 200

```jsonc
{ "outcome": "hired" }
{ "outcome": "not_selected", "note": "Strong on SQL — we needed more Spark depth." }
```

| Outcome | Effect |
|---|---|
| `hired` | match → `archived`, **job → `filled`** (leaves every candidate's deck) |
| `not_selected` | match → `closed`, optional note stored and shown to the candidate |

Recruiter-only — this is a hiring decision, not a mutual one; a candidate gets `404`. Can only be
set once (`400` after). Both parties get a live `match:outcome` event.

> **There is no `POST /matches`.** A match only ever exists as a server-derived consequence of two
> independent, authenticated swipes. This is verified as an explicit test.

---

### 3.8 Chat — `/api/matches/:id/messages`

Chat hangs off a match id, because a match *is* the conversation. There is no conversation id and no
way to open a thread with someone you haven't matched with — the absence of a cold-message path is
structural, not a check that could be forgotten.

Participation is re-checked on **every** read and **every** send, not assumed from a prior socket
connection.

#### `GET /matches/:id/messages?before=<messageId>` → 200

```jsonc
{
  "items": [{ "id": "12", "matchId", "senderId", "content", "sentAt", "readAt" }],
  "nextCursor": "7"   // pass as ?before= ; null when exhausted
}
```

Newest first, 50 per page. Message ids are monotonic integers, so the id itself is the cursor.
**Readable even on a closed or archived match** — the history is part of what happened.

#### `POST /matches/:id/messages` → 201

```jsonc
{ "content": "Hi — happy to talk about the ledger role." }   // 1–2000 chars
```

Returns the created message. Delivered to both parties over the socket as `message:new` (the sender
gets it too, so their other devices stay in sync).

`400` on an empty/whitespace message, or on a match that is no longer `active`.

#### `POST /matches/:id/messages/read` → 200

```jsonc
{ "updated": 3 }
```

Marks everything the **other** party sent as read. Scoped that way so a client can't mark its own
messages read and quietly clear the other side's badge.

---

### 3.9 Interviews — `/api/matches/:id/interview`

One round: recruiter proposes, candidate accepts. No reject-and-re-propose history, no calendar sync.

#### `GET /matches/:id/interview` → 200

Returns the interview or `null`. Either participant.

#### `POST /matches/:id/interview` · recruiter only · → 200

```jsonc
{
  "slots": [
    { "start": "2026-08-24T10:00:00+05:30", "end": "2026-08-24T11:00:00+05:30",
      "timezone": "Asia/Kolkata" }
  ]
}
```

1–5 slots. Rejected with `400` if a slot ends before it starts, is in the past, or duplicates
another. A pending proposal can be replaced; a confirmed one can't (`409`).

#### `POST /matches/:id/interview/accept` · candidate only · → 200

```jsonc
{ "slotIndex": 1 }
```

**An index into the stored proposal, not a slot object.** If the client sent the slot itself it
could confirm a time nobody offered — the server would have nothing to check it against.

`409` if already confirmed. `400` if the index isn't one of the offered slots.

---

## 4. Realtime — Socket.io

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000/realtime', {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

Authenticated at handshake with the same access token as REST. An unauthenticated socket is
**disconnected**, not left connected in a degraded state. Each user joins a private room, so events
reach every device they have open and nobody else.

| Event | Sent to | Payload |
|---|---|---|
| `match:created` | both parties | `{ matchId, jobId, jobTitle, companyName, matchScore, matchedAt }` |
| `match:outcome` | both parties | `{ matchId, status, outcome, outcomeNote }` |
| `message:new` | both parties | the full message object |
| `message:read` | the sender | `{ matchId, readerId }` |
| `interview:proposed` | both parties | `{ matchId, interviewId, proposedSlots }` |
| `interview:confirmed` | both parties | `{ matchId, interviewId, confirmedSlot }` |

Writes go over REST; the socket is for **delivery**. One write path means the match check and
validation only have to be right once.

No Redis adapter — a single instance has no cross-instance fan-out problem.

---

## 5. Match scoring

Pure function, no database, fully unit-tested. A client will ask why a card says 74, so it has to be
inspectable.

```
score = skills × 0.80 + experience × 0.20     (0–100, rounded)
```

**Skills** — share of *the job's* stack the candidate has:

```
matched required skills / total required skills
```

The denominator is the job's stack, not the union of both. A candidate who knows all five required
skills plus twenty others has met the requirement completely; Jaccard would punish them for breadth.
Matching is case-insensitive, since the recruiter types the stack by hand and the candidate's list
comes from the parser.

**Experience** — full marks at or above the requirement, tapering linearly to zero over the three
years below it:

| Candidate vs required | Factor |
|---|---|
| at or above | 1.00 |
| 1 year short | 0.67 |
| 2 years short | 0.33 |
| 3+ years short | 0.00 |

A cliff at the requirement would score a four-year candidate for a five-year role the same as a
fresher, which is wrong and looks wrong on the deck.

An unstated requirement counts as no requirement (factor 1). Unstated candidate experience counts as
zero — nothing here can invent experience, and onboarding asks for it as a plain field.

The semantic-similarity factor from the spec is **not** included: embeddings are out of scope for
this build, and the spec's own instruction in that case is to reweight to 80/20. The
`resume_embedding` and `jobs.embedding` columns and their HNSW indexes exist, so turning it on later
is a config change rather than a migration.

Seeded data produces a real spread — 100 / 73 / 47 / 40 / 20 across one candidate's deck — because a
deck where everything reads 90%+ looks fabricated.

---

## 6. Database schema

Postgres 17.6 on Supabase. Extensions: `vector` 0.8.2, `pgcrypto` 1.3, `citext` 1.6.

Eleven tables in `public`. (Supabase keeps its own `auth.users` and `realtime.messages` in other
schemas — same names, unrelated.)

```
users ──┬── profiles                 (1:1, both roles)
        ├── candidate_profiles       (1:1, candidates)
        ├── recruiter_profiles ── companies
        ├── refresh_tokens           (1:many)
        ├── swipes                   (as actor)
        └── matches                  (as candidate or recruiter)

companies ── jobs ── matches ──┬── messages
                               └── interviews
```

### `users`
| column | type | |
|---|---|---|
| `id` | uuid PK | |
| `email` | **citext** unique | case-insensitive, so two casings can't be two accounts |
| `password_hash` | text null | null for OAuth-only accounts |
| `role` | `user_role` | `candidate` \| `recruiter` |
| `created_at` | timestamptz | |

### `profiles` — common fields, keyed on `user_id`
`full_name` (NOT NULL), `avatar_url`, `location_city`, `created_at`

### `candidate_profiles` — keyed on `user_id`
`headline`, `current_title`, `years_experience` (int2), `skills` (text[]), `resume_s3_key`,
`resume_embedding` (vector, unused), `expected_salary_min/max` (int4),
`preferred_work_mode` (`work_mode`), `notice_period_days` (int2)

### `companies`
`id` uuid PK, `name` (NOT NULL), `logo_url`, `industry`, `verified` bool default **true**

### `recruiter_profiles` — joins a recruiter to their company
`user_id` PK, `company_id` FK, `created_at`

### `jobs`
`id` uuid PK, `company_id` FK, `recruiter_id` FK, `title` (NOT NULL), `description`,
`tech_stack` (text[]), `comp_min/max` (int4), `location_city`, `work_mode`,
`experience_min_years` (int2), `embedding` (vector, unused), `status` default `active`, `created_at`

### `swipes` — BIGSERIAL, high write volume
`id` int8 PK, `actor_id`, `target_id` (polymorphic, no FK by design), `target_type`
(`job`\|`candidate`), `direction` (`left`\|`right`), `job_id` (null for candidate→job), `created_at`

Two **partial** unique indexes, not one:

```sql
UNIQUE (actor_id, target_type, target_id)          WHERE job_id IS NULL      -- candidate → job
UNIQUE (actor_id, target_type, target_id, job_id)  WHERE job_id IS NOT NULL  -- recruiter → candidate
```

A single constraint including `job_id` would silently fail to protect every candidate→job swipe,
because Postgres treats NULLs as distinct.

### `matches`
`id` uuid PK, `candidate_id`, `recruiter_id`, `job_id`, `match_score` (int2, snapshotted at match
time), `status` (`active`\|`archived`\|`closed`), `outcome_note`, `matched_at`

**`UNIQUE (candidate_id, job_id)`** — this constraint is what makes match creation exactly-once
under concurrency.

### `messages` — BIGSERIAL
`id` int8 PK, `match_id` FK (cascade), `sender_id`, `content`, `sent_at`, `read_at`

No `conversations` table by design — a match *is* the thread.

### `interviews`
`id` uuid PK, `match_id` FK (cascade), `proposed_by`, `proposed_slots` (jsonb),
`confirmed_slot` (jsonb), `status` (`proposed`\|`confirmed`)

### `refresh_tokens`
`id` uuid PK, `user_id` FK (cascade), `token_hash` (SHA-256, unique), `expires_at`, `revoked_at`,
`created_at`

Revoked rather than deleted, so a later reuse attempt is distinguishable from an unknown token.

---

## 7. Where this differs from the demo spec

Five additions beyond `SwipeHire-DEMO-Architecture.md` §3, each in its own migration so the
deviation is visible in history rather than folded in silently.

| # | Change | Why it was necessary |
|---|---|---|
| 1 | `CREATE EXTENSION citext` | §3 declares `email CITEXT` but only creates `vector` and `pgcrypto`. Running it verbatim fails outright. |
| 2 | `matches.outcome_note` | The Outcome tail of the client's journey diagram, which the demo docs never covered. |
| 3 | `refresh_tokens` table | Security Baseline §1 requires server-side refresh storage; §3 has nowhere to put it (the full spec's `sessions` table is among those dropped). Without it, logout couldn't revoke anything. |
| 4 | `recruiter_profiles` table | §3 keeps `companies` but drops the link between a recruiter and one. The recruiter journey sets up a company *before* posting a job, so `jobs.company_id` can't serve as the link. |
| 5 | `swipes.job_id` + split unique indexes | §3 has no job column, so a recruiter passing on a candidate for one listing lost them from every listing, and match detection couldn't tell which job a right-swipe was for — while `matches` is keyed per job. The demo docs get away with it only because their PRD has each recruiter create exactly one listing. |

Also noted, not changed: the spec's own single unique constraint on swipes has a NULL hole
(see §6 above).

---

## 8. Security properties actually implemented

From `SwipeHire-DEMO-Security-Baseline.md` §1 — the things it says not to skip even under time
pressure.

- **Argon2id password hashing.** Never plaintext, not even for seed accounts.
- **Ownership checked server-side on every resource-ID endpoint.** `404`, not `403`, for "exists but
  not yours" — the two cases are indistinguishable from outside.
- **Blind-first enforced in the serializer.** Surnames, emails and resume keys never enter a
  pre-match payload.
- **No client-created matches.** No `POST /matches` exists; verified by test.
- **Files only via short-lived signed URLs.** The bucket is private and refuses unsigned reads —
  also verified by test.
- **Input validation on every endpoint**, rejecting undeclared fields.
- **No secrets in the repo.** `.env` is git-ignored; `.env.example` carries only placeholders.
- **No cold-messaging path.** Chat is reachable only through an active match, re-checked on every
  read and every send.
- **Account enumeration resistance** on login, in both message and timing.
- **Content sniffing on upload** — magic bytes, not the declared MIME type, which the client controls.

Deliberately **not** implemented: RLS policies, malware scanning, rate limiting, refresh-token
rotation and reuse detection, recruiter verification, DPDP consent flows, penetration testing.
These are what stand between this build and a public link — enumerated with reasoning in
`Security.md` §3.

---

## 9. Seed data

`npm run seed` — re-runnable, clears only what it previously created (recognised by the
`@swipehire.demo` address).

- 5 companies with a recruiter each
- 18 jobs, 18 candidates
- **One primed match**: the Razorpay ledger role sorts to the top of `aditi@swipehire.demo`'s deck at
  100%, and that recruiter has already right-swiped her. Her first right-swipe fires the match live.
  Only the recruiter's half is seeded — seeding both would leave nothing to happen on camera.
- One conversation already in progress, three messages, last one unread
- One confirmed interview
- One `archived`/hired and one `closed`/not-selected match, so the matches list shows the whole
  lifecycle

**Password for every seeded account: `swipehire2026`**

| Account | |
|---|---|
| `aditi@swipehire.demo` | The demo candidate. Primed match, live conversation, one closed match with feedback. |
| `hr.razorpay@swipehire.demo` | Recruiter, 4 listings, 17 candidates ranked per listing. |
| `hr.postman@swipehire.demo` | Recruiter holding the seeded conversation. |
| `hr.zerodha@` `hr.swiggy@` `hr.cred@` | Three more recruiters with their own listings. |

---

## 10. Error shapes

Standard NestJS envelope:

```jsonc
{ "message": "Invalid email or password", "error": "Unauthorized", "statusCode": 401 }
```

Validation failures return `message` as an **array** of strings, one per failed rule.

| Code | Means |
|---|---|
| `400` | Validation failed, or a business rule was broken (e.g. salary min above max) |
| `401` | Missing, malformed, or expired access token |
| `403` | Authenticated, but wrong role for this endpoint |
| `404` | Doesn't exist — **or exists and isn't yours** |
| `409` | Conflict — email taken, interview already confirmed |
| `422` | The PDF was readable as a file but not usable as a resume |
| `503` | A dependency isn't configured (currently only Google sign-in) |

Errors never echo back internal detail. Storage failures, database errors and token contents go to
the logs, not the response body.

---

## 11. Environment variables

```bash
NODE_ENV=development
PORT=3000
CORS_ORIGINS=                      # comma-separated; localhost defaults in dev

DATABASE_URL=                      # Supabase Postgres connection string

JWT_ACCESS_SECRET=                 # two DIFFERENT secrets — signing refresh with the
JWT_REFRESH_SECRET=                # access secret would make a stolen access token
                                   # exchangeable for a 30-day session
GOOGLE_OAUTH_CLIENT_ID=            # unset → POST /auth/google returns 503
GOOGLE_OAUTH_CLIENT_SECRET=        # unused; the code flow isn't used

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=         # backend only, never shipped to a client
SUPABASE_STORAGE_BUCKET=resumes
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 12. What the backend does *not* have

Nothing here is missing by accident.

| | Why |
|---|---|
| Push notifications (APNs/FCM) | Cut for the demo; the socket carries the same events in-app |
| Calendar sync | Cut; the flow goes confirm → scheduled directly |
| Recruiter verification workflow | Auto-verified; the badge renders, there's no queue behind it |
| Filters on either deck | Cut from demo scope; the ranking they'd sit on top of is real |
| Fast-Track / Super Swipe | Out of scope in the original PRD too |
| Admin dashboard, moderation, reporting | Cut entirely |
| Embeddings / semantic matching | Out of scope; columns and indexes exist for later |
| Redis, SQS, background workers | Production concerns a demo never exercises |
| Google sign-in on the client | Implemented server-side; needs EAS dev builds to wire up |
