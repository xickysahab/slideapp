# SwipeHire — DEMO Architecture
### Scope: Client Showcase Build — lightweight stack, real backend, zero cloud-ops overhead

---

## 0. What Changed From the Full Architecture Doc, and Why

The original `SwipeHire_Technical_Architecture.md` is built for a system that has to survive real production load, a security review, and a scaling path. A demo has exactly one load pattern: one or two phones, in front of one client, for a few minutes. Every simplification below trades "production-readiness" for "time to a working build" — nothing here is a permanent architecture decision, and the full doc's reasoning is still correct for when this becomes a real product.

**Rule for this build:** if a piece of infrastructure exists only to handle scale, concurrency, or failure modes that a live demo will never hit, cut it. If it exists to make the product *look and feel* real (design system, real match scoring, real chat), keep it — that's what actually sells the demo.

---

## 1. Stack

| Layer | Full-spec version | Demo version | Why |
|---|---|---|---|
| Mobile | React Native, New Architecture, EAS | Same — **keep** | This is the part the client actually sees; no shortcuts here |
| Backend | NestJS modular monolith on ECS Fargate | **NestJS modular monolith — same framework, same module boundaries — deployed to Railway or Render** | Git-push deploy, no Docker/Terraform/IAM setup required; module boundaries kept so this can move to Fargate later without a rewrite |
| Database | RDS Postgres Multi-AZ + pgvector | **Neon or Supabase Postgres (free/hobby tier), pgvector extension enabled** | Both support pgvector out of the box, both have a working free tier, zero infra to provision |
| Cache / swipe hot path | Redis (ElastiCache), Redis-driven match-check pipeline | **Cut. Match-check is a direct, indexed Postgres query.** | At demo traffic (single-digit swipes/second, ever), Postgres with a unique index is fast enough that Redis adds setup cost with zero visible benefit |
| Queue / async workers | SQS + BullMQ | **Cut. Everything runs synchronously in the request handler.** | No background worker infra to deploy or debug for a five-minute demo |
| Search | OpenSearch (deferred anyway in the full spec) | **Cut entirely — not even Postgres full-text search.** | Demo has no search UI (see Demo PRD §2) |
| NLP / resume parsing | Separate Python FastAPI microservice, deterministic + LLM fallback, sentence-transformer embeddings | **Folded into the NestJS backend itself** — `pdf-parse` for text extraction, a hardcoded skills-taxonomy keyword matcher, **optional** call to a hosted embeddings API (OpenAI or Cohere) for the semantic-similarity part of the match score | One deployable instead of two; no LLM fallback needed since there's no messy real-world resume volume to handle, just seed data you control |
| Real-time chat | Socket.io + Redis adapter, dedicated Chat Gateway service | **Socket.io on the same single NestJS instance** | One instance can't have a cross-instance fan-out problem — the Redis adapter only matters once you're horizontally scaled |
| File storage | S3 + CloudFront, SSE-KMS, malware scanning Lambda | **A single private S3 bucket (or Supabase Storage), presigned URLs. No malware scanning.** | Demo uploads are either your own seed files or the client's own resume in a live demo — real malware scanning is a pre-launch requirement, not a demo one |
| Auth | Custom JWT + Passport, OTP, biometric, OAuth | **Same JWT + refresh pattern, email/password + Google OAuth only** | Keeps the "we built real auth, not Firebase-magic" story; drops OTP/SMS provider setup and biometric (which needs a real device anyway) |
| Push notifications | SNS → APNs/FCM | **Cut — in-app toast/badge only** | APNs/FCM cert setup is disproportionate effort for a demo; the match/message event still fires, it just renders as an in-app UI update instead of a system push |
| Deployment target | ECS Fargate behind an ALB, CloudFront, Route 53 | **Backend: Railway or Render (free/hobby tier). Mobile: Expo Go (scan a QR code) or an EAS preview build (shareable link, installs like a real app, no store review).** | Client sees a real, installed-feeling app in minutes, not a store listing that takes days to review |

**Net effect:** one deployable backend service, one managed Postgres instance, no queues, no cache layer, no second language/runtime, no cloud account to provision. A single `git push` updates the backend; `eas update` pushes a new build to the client's phone.

---

## 2. System Diagram (demo version)

```
React Native App (Expo)
        │ HTTPS (REST) + WSS (Socket.io)
        ▼
NestJS backend (Railway/Render, single instance)
  ├─ Auth Module
  ├─ Profile Module
  ├─ Job Module
  ├─ Swipe/Match Module   (direct Postgres read/write, no Redis)
  ├─ Chat Module          (Socket.io, in-process)
  ├─ Interview Module
  └─ Resume Module        (pdf-parse + skills-taxonomy matcher, optional embeddings API call)
        │
        ▼
Postgres (Neon/Supabase, pgvector enabled)
        │
        ▼
S3 (or Supabase Storage) — resumes only, presigned URLs
```

That's the entire system. Module boundaries inside the NestJS app are kept identical to the full architecture doc (§3.1 of that doc) on purpose — this isn't a different codebase, it's the same codebase with infrastructure stripped out, so nothing needs to be rewritten if this later grows into the real build.

---

## 3. Database Schema (Demo)

Trimmed to exactly what the demo journey (Demo PRD §3) touches. Full-spec tables not listed here (`reports`, `recruiter_verifications`, `notifications`, `sessions`, `candidate_skills` junction table, audit logs) are simply not created for the demo.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('candidate', 'recruiter');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT,                    -- NULL if Google-OAuth-only
    role            user_role NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    avatar_url      TEXT,
    location_city   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE work_mode AS ENUM ('remote', 'hybrid', 'onsite');

CREATE TABLE candidate_profiles (
    user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline              TEXT,
    current_title         TEXT,
    years_experience      SMALLINT,
    skills                TEXT[] DEFAULT '{}',
    resume_s3_key         TEXT,
    resume_embedding      VECTOR(768),         -- nullable; only populated if the embeddings API call is enabled
    expected_salary_min   INTEGER,
    expected_salary_max   INTEGER,
    preferred_work_mode   work_mode,
    notice_period_days    SMALLINT
);

CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    logo_url    TEXT,
    industry    TEXT,
    verified    BOOLEAN NOT NULL DEFAULT true   -- always true in demo mode, see Demo PRD §2 row 4
);

CREATE TABLE jobs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID NOT NULL REFERENCES companies(id),
    recruiter_id         UUID NOT NULL REFERENCES users(id),
    title                TEXT NOT NULL,
    description          TEXT,
    tech_stack           TEXT[] DEFAULT '{}',
    comp_min             INTEGER,
    comp_max             INTEGER,
    location_city        TEXT,
    work_mode            work_mode,
    experience_min_years SMALLINT,
    embedding            VECTOR(768),          -- nullable, same as above
    status               TEXT NOT NULL DEFAULT 'active',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE swipes (
    id           BIGSERIAL PRIMARY KEY,
    actor_id     UUID NOT NULL REFERENCES users(id),
    target_id    UUID NOT NULL,                -- candidate user_id OR job id, per target_type
    target_type  TEXT NOT NULL CHECK (target_type IN ('candidate', 'job')),
    direction    TEXT NOT NULL CHECK (direction IN ('left', 'right')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (actor_id, target_id, target_type)
);

CREATE TABLE matches (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id   UUID NOT NULL REFERENCES users(id),
    recruiter_id   UUID NOT NULL REFERENCES users(id),
    job_id         UUID NOT NULL REFERENCES jobs(id),
    match_score    SMALLINT,                   -- 0-100, snapshotted at match time
    status         TEXT NOT NULL DEFAULT 'active',
    matched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (candidate_id, job_id)
);

CREATE TABLE messages (
    id          BIGSERIAL PRIMARY KEY,
    match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at     TIMESTAMPTZ
);

CREATE TABLE interviews (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id         UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    proposed_by      UUID NOT NULL REFERENCES users(id),
    proposed_slots   JSONB NOT NULL,           -- [{start, end, timezone}, ...]
    confirmed_slot   JSONB,
    status           TEXT NOT NULL DEFAULT 'proposed'  -- proposed | confirmed
);

-- Only needed if the optional embeddings API call is enabled (§4)
CREATE INDEX ON candidate_profiles USING hnsw (resume_embedding vector_cosine_ops);
CREATE INDEX ON jobs USING hnsw (embedding vector_cosine_ops);
```

9 tables total, versus the full spec's dozen-plus. Every table here maps 1:1 to a table in the full architecture doc (§4) with the same name/purpose — nothing invented, only trimmed — so migrating toward the real schema later is additive, not a rewrite.

---

## 4. Swipe → Match Flow (Demo Version)

The full spec's Redis-buffered, queue-flushed pipeline (Architecture §5) exists to survive thousands of swipes per second. A demo will see, at most, a few dozen swipes total, live, in front of one person. Do this instead:

1. `POST /swipes { targetId, targetType, direction }` — server does an `INSERT ... ON CONFLICT (actor_id, target_id, target_type) DO UPDATE SET direction = EXCLUDED.direction` directly into `swipes`. This is synchronous and that's fine — Postgres handles this in single-digit milliseconds at this volume.
2. If `direction = 'right'`: server runs one query checking whether the reciprocal swipe already exists (candidate swiped right on this job AND recruiter swiped right on this candidate for this job).
3. If reciprocal interest exists: `INSERT INTO matches (...) ON CONFLICT (candidate_id, job_id) DO NOTHING RETURNING id` inside a transaction. Respond `{ matched: true, matchId }`.
4. Emit a Socket.io event to both users' sockets if connected (`match:created`), so the in-app "It's a Match!" screen can render live without a page refresh.

This is the same logical guarantee as the full pipeline (exactly-once match creation via a unique constraint, server-only match creation, no client-asserted matches) — it's just synchronous instead of buffered. **Do not skip the unique constraints or the "match creation is server-derived, never client-submitted" rule even in the demo** — that's a correctness property, not a scale optimization, and it's cheap to keep.

---

## 5. Match Scoring (Demo Version)

Simplified from the full spec's 7-factor formula (Architecture §7.1) to keep the "why this match" story intact without needing salary/notice-period/role-title nuance:

| Factor | Weight | Computed from |
|---|---|---|
| Skills overlap | 60% (100% if embeddings are skipped) | Set overlap between `candidate_profiles.skills` and `jobs.tech_stack` |
| Semantic similarity | 25% | Cosine similarity between `resume_embedding` and `jobs.embedding`, **only if the optional embeddings API call is wired up** |
| Experience fit | 15% | Simple piecewise: full score at/above `jobs.experience_min_years`, tapering below it |

If the embeddings API call is skipped entirely (recommended if time is tight — see §1), just reweight to skills 80% / experience 20% and drop the semantic-similarity row. The match score is still real and still varies meaningfully across seeded candidates/jobs — it just isn't using a vector model under the hood. Either version is honest to show a client; don't fake a number that doesn't come from real computation.

---

## 6. Resume Parsing (Demo Version)

No separate service, no LLM fallback:

1. Candidate uploads a PDF → presigned S3 PUT, same pattern as the full spec.
2. Backend downloads the object, extracts text via `pdf-parse`.
3. A hardcoded skills-taxonomy array (50–100 common tech skills is plenty for a demo — React, Node.js, Python, AWS, SQL, etc.) is matched against the extracted text via case-insensitive substring/word-boundary matching.
4. Matched skills populate `candidate_profiles.skills`. No years-of-experience/education extraction needed — ask for those as simple form fields during onboarding instead of trying to parse them.
5. (Optional) send the extracted text to a hosted embeddings API and store the result in `resume_embedding`.

This is deliberately less accurate than the full spec's deterministic-pipeline + LLM-fallback design — that's fine, because in a demo you control the seed resumes and can hand-pick ones that parse cleanly.

---

## 7. Environment Variables (Demo)

Far shorter than the full spec's list (Architecture §12):

```
DATABASE_URL              # Neon/Supabase connection string
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
S3_BUCKET_NAME
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
EMBEDDINGS_API_KEY        # optional — omit entirely if skipping §5's semantic factor
NODE_ENV
PORT
```

No AWS Secrets Manager needed — Railway/Render both have a built-in encrypted environment-variable panel, which is sufficient for a demo (not for production — the full spec's Secrets Manager requirement still applies before a real launch).

---

## 8. What to Do When It's Time to Go From Demo to Real

Nothing here is thrown away — it's additive:
- Swap Railway/Render → ECS Fargate + Terraform (Architecture §11).
- Swap direct Postgres swipe writes → Redis-buffered pipeline (Architecture §5) once real concurrent traffic exists.
- Add the SQS/async worker layer back for notifications, resume parsing bursts, and search indexing.
- Add RLS policies, verification workflows, malware scanning, real push notifications (Security doc, full Architecture doc).
- Split the Python NLP service back out if LLM-fallback parsing becomes necessary for messy real-world resumes.

The module boundaries and schema were kept deliberately aligned to the full spec specifically so this transition doesn't require a rewrite — it requires re-adding infrastructure around the same core modules.
