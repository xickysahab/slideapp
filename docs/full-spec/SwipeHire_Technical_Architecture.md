# SwipeHire — Technical Architecture Document

**Version:** 1.0 (MVP → Scale)
**Prepared for:** SwipeHire — Dual-Sided Swipe-Based Hiring Marketplace (iOS / Android)
**Scope:** Production-quality MVP architecture with an explicit scaling path

---

## Table of Contents

1. Recommended Tech Stack
2. System Architecture
3. Backend Architecture
4. Database Schema (PostgreSQL)
5. Swipe & Matching Architecture
6. Resume Processing Pipeline
7. Match Scoring System
8. Search & Discovery
9. Real-Time Chat
10. Interview Scheduling
11. AWS Architecture (MVP vs. Scale)
12. Environment & Configuration
13. Folder Structure
14. Scalability
15. Architecture Decision Log

---

## 0. Executive Summary

SwipeHire is a two-sided marketplace where **candidates swipe on jobs** and **recruiters swipe on candidates**, with a mutual right-swipe producing a **match**, which unlocks **real-time chat** and, eventually, **interview scheduling**.

Three characteristics drive every decision in this document:

- **Write-heavy, low-value events at high frequency** — swipes. Every swipe is a small, cheap write, but there can be thousands per second at scale, and match detection must be near-instant so the UI feels responsive (a "It's a Match!" moment is the emotional core of the product).
- **Read-heavy, personalized ranking** — the swipe deck itself is a recommendation/search problem (which job or candidate to show next), not just a CRUD list.
- **Bursty, semi-heavy background processing** — resume parsing/NLP is not instant and must not block the user-facing request path.

These three shapes map cleanly onto three different storage/processing primitives: **Redis** for the hot swipe path, **PostgreSQL** as the system of record, and an **async worker + queue** layer for parsing, scoring, and notifications. Everything else in the architecture exists to support that core loop.

---

## 1. Recommended Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Mobile Frontend** | React Native (New Architecture) + TypeScript, Reanimated v4, Gesture Handler 2 | Single codebase for iOS/Android for a solo/small team; Reanimated v4 runs gesture-driven swipe animations on the UI thread (not the JS thread), which is non-negotiable for a swipe-card interaction to feel native. |
| **Backend Framework** | NestJS (Node.js + TypeScript), modular monolith | Opinionated module boundaries (DI, decorators, guards, interceptors) give you microservice-shaped code without microservice-shaped ops overhead at MVP scale. Shares TypeScript types/DTOs with the frontend via a shared package. |
| **Primary Language** | TypeScript (backend + frontend), Python (NLP/AI service only) | One language across the whole product surface minimizes context switching for a small team; Python is used **only** where its ML/NLP ecosystem is genuinely irreplaceable. |
| **Primary Database** | PostgreSQL 16 (Amazon RDS) | ACID guarantees for matches, messages, and interview state where correctness matters; native `pgvector` extension supports semantic candidate↔job similarity without a separate vector DB at MVP scale; mature JSON support (`jsonb`) for flexible profile fields. |
| **Vector Search** | PostgreSQL + `pgvector` (HNSW index) | Keeps resume/job embeddings co-located with relational data at MVP scale — one database to operate, one transaction boundary. Migrate to a dedicated vector store (or OpenSearch k-NN) only once embedding volume/query latency demands it. |
| **Cache / Hot Path Store** | Redis (Amazon ElastiCache) | Sub-millisecond swipe buffering, match-detection lookups (`SETNX`/hash checks), rate limiting, session/presence data, and pub/sub for WebSocket fan-out across instances. |
| **Search Engine** | OpenSearch (Elasticsearch-compatible, AWS-managed) | Full-text + faceted search (skills, location, salary band, remote/hybrid, notice period) with fast filtering at scale. Deferred past absolute MVP day-one if swipe-deck ranking alone is sufficient initially, but designed in from the start (Section 8). |
| **Object Storage** | Amazon S3 (private buckets, presigned URLs) | Resumes, profile photos, company logos. Never store binaries in Postgres. |
| **Real-Time Communication** | Socket.io (WebSocket, with polling fallback) over a dedicated Chat Gateway, Redis adapter for multi-instance fan-out | Handles reconnection/backoff, room-based broadcasting (one room per match), and horizontal scaling via `socket.io-redis-adapter` out of the box — reinventing this is not a good use of MVP time. |
| **Message Storage** | PostgreSQL (`messages` table, partitioned by month at scale) | Messages need durability, ordering, and read-status guarantees; Postgres row-level locking and transactions handle this correctly. Redis is used only for ephemeral presence/typing indicators, not message durability. |
| **Queue / Event System** | Amazon SQS (standard + FIFO where ordering matters) with a thin BullMQ (Redis-backed) layer for local dev | SQS for durable, at-least-once delivery of cross-service events in production (resume parsing jobs, notification dispatch, match-created events); BullMQ mirrors the same job contracts locally without needing AWS credentials in dev. |
| **Authentication** | Custom JWT (access + refresh token pair) issued by NestJS, backed by Passport.js strategies; OAuth2 (Google/LinkedIn) as social login | Full control over token claims (role: candidate/recruiter), refresh rotation, and device-level revocation — important for a mobile app with long-lived sessions. Avoids vendor lock-in of a hosted auth product at this stage. |
| **Push Notifications** | Amazon SNS → APNs (iOS) / FCM (Android), via a Notification Service | SNS gives one API surface for both platforms and integrates natively with SQS for fan-out from backend events. |
| **AI / NLP Services** | Python 3.12 + FastAPI microservice; `spaCy` / `pyresparser`-style pipeline for resume parsing; sentence-transformer embeddings for skill/semantic matching; optional LLM call (Claude via Bedrock or direct API) for structured extraction fallback | FastAPI is the fastest path to a typed, async, production-ready Python service; combining a deterministic NLP pipeline with an LLM fallback keeps parsing cheap for the common case and robust for messy resumes. |
| **Monitoring & Observability** | CloudWatch (infra metrics/logs) + Sentry (error tracking, FE + BE) + OpenTelemetry traces → CloudWatch/X-Ray | CloudWatch is "free" with AWS and sufficient for MVP infra signals; Sentry catches the errors CloudWatch won't (mobile crashes, unhandled promise rejections); OpenTelemetry keeps you portable if you later move to Grafana/Datadog. |
| **Cloud Infrastructure** | AWS (ECS Fargate, RDS, ElastiCache, S3, SQS, SNS, CloudFront, Lambda for edge jobs, ACM/Route53) | Fargate removes EC2/node management for a small team; every managed service above (RDS, ElastiCache, OpenSearch, SQS, SNS) has a first-class AWS-managed counterpart, keeping the whole stack inside one provider for MVP simplicity. |

**Note on scope discipline:** OpenSearch, the Python NLP service, and full SNS-based push are all designed into the architecture from day one (so schemas and service boundaries don't need rework later), but an actual MVP launch can defer OpenSearch (use Postgres full-text search initially) and the LLM-fallback path in the NLP service without touching the rest of the system. This is called out again in Section 11.


---

## 2. System Architecture

### 2.1 High-Level Component Diagram

```
                                   ┌─────────────────────────┐
                                   │   React Native App       │
                                   │  (iOS / Android)         │
                                   │  - Swipe Deck UI          │
                                   │  - Chat UI                │
                                   │  - Push notification      │
                                   │    receiver (APNs/FCM)    │
                                   └────────────┬─────────────┘
                                                │ HTTPS (REST/JSON)  +  WSS (Socket.io)
                                                ▼
                                   ┌─────────────────────────┐
                                   │  CloudFront (CDN, TLS)   │
                                   │  + API Gateway / ALB     │
                                   │  - Rate limiting          │
                                   │  - WAF                    │
                                   └────────────┬─────────────┘
                                                │
                    ┌───────────────────────────┼────────────────────────────┐
                    ▼                           ▼                            ▼
        ┌───────────────────┐      ┌────────────────────────┐    ┌─────────────────────┐
        │   Core API         │      │  Matching/Swipe Service │    │   Chat Gateway        │
        │  (NestJS module)   │◄────►│  (NestJS module)        │◄──►│  (NestJS + Socket.io) │
        │  - Auth             │      │  - Swipe ingestion       │    │  - WS connections      │
        │  - Users/Profiles   │      │  - Match detection       │    │  - Rooms per match     │
        │  - Jobs/Companies   │      │  - Deck ranking          │    │  - Presence/typing     │
        │  - Interviews        │      └────────────┬─────────────┘    └───────────┬────────────┘
        └─────────┬───────────┘                   │                              │
                  │                                │                              │
                  ▼                                ▼                              ▼
        ┌────────────────────────────────────────────────────────────────────────────────┐
        │                              Shared Data Layer                                   │
        │  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  ┌──────────────────┐ │
        │  │ PostgreSQL     │  │ Redis          │  │ OpenSearch       │  │ S3 (Object store)│ │
        │  │ (RDS, system   │  │ (ElastiCache,  │  │ (search/discovery│  │ (resumes, photos,│ │
        │  │  of record)    │  │  hot swipe +   │  │  index)          │  │  logos)          │ │
        │  │                │  │  cache + WS pub/sub) │              │  │                  │ │
        │  └───────────────┘  └───────────────┘  └────────────────┘  └──────────────────┘ │
        └───────────────────────────────┬──────────────────────────────────────────────────┘
                                        │ events (match.created, resume.uploaded, interview.proposed, ...)
                                        ▼
                            ┌───────────────────────────┐
                            │   SQS (event queue)        │
                            └────────────┬──────────────┘
                                        │
                ┌────────────────────────┼─────────────────────────┐
                ▼                        ▼                         ▼
    ┌───────────────────┐   ┌─────────────────────────┐  ┌──────────────────────┐
    │  Async Workers      │   │  Python NLP/AI Service   │  │  Notification Service │
    │  (NestJS, ECS task)  │   │  (FastAPI, ECS task)     │  │  (NestJS, ECS task)    │
    │  - Match scoring      │  │  - Resume parsing         │  │  - SNS → APNs/FCM       │
    │  - Search indexing     │◄─┤  - Skill extraction       │  │  - Email (SES)           │
    │  - Notification fan-out│  │  - Embedding generation    │  │  - In-app notifications  │
    └───────────────────────┘  └─────────────────────────┘  └──────────────────────┘
```

### 2.2 How Components Communicate

- **React Native App ↔ Edge:** All REST traffic goes over HTTPS through CloudFront (static asset caching + TLS termination) to an Application Load Balancer, which fronts the ECS Fargate services. Real-time traffic upgrades to a WebSocket (WSS) connection directly against the Chat Gateway service, sticky-routed via ALB target group affinity.
- **Edge → Core API:** The ALB routes by path prefix (`/api/v1/users`, `/api/v1/jobs`, `/api/v1/swipes`, `/api/v1/chat`, `/api/v1/interviews`, ...) to the appropriate NestJS module. At MVP scale these all live in **one deployed service** (modular monolith) behind one ALB target group; the path-based routing is a logical seam that makes future extraction into separate deployables a config change, not a rewrite.
- **Core API ↔ Matching/Swipe Service:** In-process module call at MVP (same deployable). The Matching module owns the `swipes` and `matches` tables and exposes an internal service interface (`SwipeService.recordSwipe()`, `MatchService.checkMutual()`); Core API never writes to those tables directly. This boundary is what allows Matching to be extracted into its own ECS service later without touching Core API's code, only its HTTP/gRPC client.
- **Matching Service ↔ Redis:** Every swipe write goes to Redis first (buffer + mutual-match check), described in full in Section 5. This is the only path in the system where Redis is in the **write** critical path, not just a cache.
- **Matching Service ↔ PostgreSQL:** Redis writes are asynchronously flushed to Postgres in batches by a worker, and match records are written synchronously to Postgres the moment mutual interest is confirmed (a match is too important to be cache-only, even briefly).
- **Chat Gateway ↔ Redis ↔ other Chat Gateway instances:** Socket.io's Redis adapter publishes every emitted event to a Redis pub/sub channel so that a message sent by a user connected to ECS task A reaches a recipient connected to ECS task B. This is what makes the Chat Gateway horizontally scalable behind a load balancer.
- **Core/Matching/Chat services → SQS:** Any event that should trigger asynchronous work (a match was created → notify both parties; a resume was uploaded → parse it; an interview was proposed → send push + email) is published to SQS rather than handled inline. This keeps user-facing request latency low and makes retries/backoff free.
- **Async Workers ↔ Python NLP Service:** The worker that handles `resume.uploaded` events calls the FastAPI NLP service over an internal HTTP endpoint (service discovery via AWS Cloud Map / ECS service connect), passing an S3 object reference. The NLP service is stateless and never touches Postgres directly — it returns structured JSON, and the calling worker persists it.
- **Notification Service → SNS → APNs/FCM/SES:** The Notification Service is a thin fan-out layer: it consumes queue events, resolves user notification preferences and device tokens (stored in Postgres), and publishes to the correct SNS platform endpoint or SES for email.
- **All services → CloudWatch/Sentry:** Structured JSON logs ship to CloudWatch via the ECS Fargate awslogs driver; unhandled exceptions and mobile crashes ship to Sentry independently, since CloudWatch is not built for exception-level triage.


---

## 3. Backend Architecture

### 3.1 Service Boundaries (Modular Monolith)

The NestJS backend is organized as **feature modules with enforced boundaries**, deployed as a single ECS service at MVP, each module owning its own tables and exposing only a service-layer interface to other modules (never raw repository access across module lines). This is what makes future extraction to real microservices mechanical rather than a rewrite.

| Module | Owns | Exposes |
|---|---|---|
| `AuthModule` | `users`, `sessions`, refresh tokens | `AuthService.validateUser()`, `AuthService.issueTokens()`, guards (`JwtAuthGuard`, `RolesGuard`) |
| `ProfileModule` | `profiles`, `candidate_profiles`, `recruiter_profiles`, `preferences`, `skills` | `ProfileService.getProfile()`, `ProfileService.updatePreferences()` |
| `CompanyModule` | `companies`, `recruiter_verifications` | `CompanyService.verifyRecruiter()` |
| `JobModule` | `jobs` | `JobService.createJob()`, `JobService.getActiveJobs()` |
| `SwipeMatchModule` | `swipes`, `matches` | `SwipeService.recordSwipe()`, `MatchService.getMatches()` |
| `ChatModule` | `messages` (a conversation *is* a `matches` row — see Section 4.1; WebSocket gateway lives here) | `ChatService.sendMessage()`, gateway events |
| `InterviewModule` | `interviews` | `InterviewService.proposeSlots()`, `InterviewService.confirm()` |
| `NotificationModule` | `notifications`, device tokens | `NotificationService.dispatch()` |
| `ReportModule` | `reports` | `ReportService.fileReport()` |
| `SearchModule` | (no owned tables — reads from OpenSearch) | `SearchService.query()` |

Cross-module interaction happens two ways: **direct injected service calls** for synchronous needs within the same request (e.g., `SwipeMatchModule` calling `ProfileService.getPreferences()` to help rank the next card), and **domain events** (NestJS `EventEmitter2` internally, SQS externally) for anything that can happen after the response is returned (e.g., `match.created` triggering `NotificationModule`).

### 3.2 API Structure

- **Style:** REST, versioned from day one (`/api/v1/...`), JSON:API-ish conventions (consistent envelope: `{ data, meta, errors }`).
- **Resource-oriented routes**, e.g.:
  - `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`
  - `GET /api/v1/candidates/deck` (next N job cards, ranked)
  - `GET /api/v1/recruiters/deck?jobId=...` (next N candidate cards for a job)
  - `POST /api/v1/swipes` (`{ direction, targetType, targetId }`)
  - `GET /api/v1/matches`, `GET /api/v1/matches/:id/messages`
  - `POST /api/v1/interviews/:matchId/propose`, `POST /api/v1/interviews/:id/respond`
- **DTO validation** on every route via `class-validator` + `class-transformer` decorators on request DTOs, enforced by a global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true` — unknown fields are rejected, not silently dropped).
- **Versioning strategy:** URI versioning (`/v1`, `/v2`) rather than header versioning, because it's debuggable from a raw curl/Postman call and mobile clients can pin a version per app release without custom header plumbing.

### 3.3 Authentication Middleware

- **Token scheme:** short-lived JWT access token (15 min) + long-lived opaque refresh token (30 days, stored hashed in `sessions` table, rotated on every use — reuse of an old refresh token revokes the whole session family, a standard defense against token theft).
- **Guard chain:** `JwtAuthGuard` (validates access token signature/expiry) → `RolesGuard` (checks `req.user.role` against a `@Roles('candidate' | 'recruiter')` decorator on the route) → route handler.
- **Biometric login (mobile):** device stores the refresh token in the OS secure enclave (iOS Keychain / Android Keystore) via `react-native-keychain`; biometric prompt gates *local* access to that stored token, it does not itself authenticate to the backend — the backend still only ever sees the refresh token exchange.

### 3.4 Authorization

- **Role-based** at the coarse level (`candidate` vs `recruiter` vs `admin`), enforced by `RolesGuard`.
- **Ownership-based** at the resource level via a custom `OwnershipGuard`/policy check inside each service method — e.g., a recruiter can only propose interview slots on a match that belongs to one of *their own* job listings; a candidate can only read messages in conversations they're a participant of. This check happens in the service layer (not just the controller) so it can't be bypassed by an internal call path.

### 3.5 Validation

- Request-level: DTO class-validator decorators (`@IsUUID()`, `@IsEnum(SwipeDirection)`, `@Length()`, etc.), rejected with `400` before hitting business logic.
- Domain-level: service-layer invariant checks that DTOs can't express (e.g., "a recruiter can't swipe on a candidate for a job that isn't `active`"), raising typed domain exceptions.
- Database-level: `NOT NULL`, `CHECK`, foreign key, and unique constraints as the last line of defense (Section 4) — the API should never rely on the DB constraint to be the *first* validation, only the guarantee.

### 3.6 Error Handling

- A global `AllExceptionsFilter` catches everything, maps known domain exceptions (`NotFoundException`, `ForbiddenException`, custom `DomainException` subclasses) to consistent HTTP status codes and a stable error-code string (e.g., `MATCH_NOT_FOUND`, `SWIPE_ALREADY_RECORDED`) that the mobile client can branch on without parsing English messages.
- Unhandled/unexpected errors are logged with full stack trace to CloudWatch + Sentry and returned to the client as a generic `500` with no internal detail leaked.
- All error responses share one envelope shape: `{ "error": { "code": "STRING", "message": "human readable", "details": {...} } }`.

### 3.7 Background Jobs

Two tiers, matched to two different reliability needs:

- **BullMQ (Redis-backed) — same-cluster, low-latency jobs:** swipe-buffer flush to Postgres, deck-cache warming, presence TTL cleanup. These are cheap, frequent, and tolerate at-most-once semantics reasonably well since the swipe buffer itself is the durability layer until flush.
- **SQS-consumed jobs — cross-service, must-not-lose jobs:** resume parsing, match-scoring recomputation, notification dispatch, search index updates. These use SQS's at-least-once delivery + visibility timeout + dead-letter queue, because losing a "you got a match" notification or a resume parse is a real product failure, not just a stale cache.

### 3.8 WebSocket Architecture

- NestJS `@WebSocketGateway` backed by Socket.io, with the `socket.io-redis-adapter` so events broadcast across every ECS task running the Chat Gateway.
- **Connection auth:** the JWT access token is passed as a query param / auth payload on the initial handshake and validated by a WS-specific guard before the connection is accepted; unauthenticated sockets are dropped immediately.
- **Rooms:** one Socket.io room per `matchId`. A client joins the room for every match they're part of on connect; a new match triggers a server-side `join` for both parties' active sockets.
- **Reconnection:** handled client-side by Socket.io's built-in exponential backoff; on reconnect the client sends `lastMessageTimestamp` and the server replays any missed messages from Postgres (Redis pub/sub has no memory — Postgres is the source of truth for anything sent while disconnected).

### 3.9 Rate Limiting

- **Edge-level (coarse, DDoS-oriented):** AWS WAF rate-based rule on the ALB/CloudFront — blocks IPs exceeding a high global request threshold.
- **Application-level (per-user, business-oriented):** `@nestjs/throttler` backed by Redis, with different limits per route class:
  - Swipes: capped (e.g., 100/min) — generous enough for real usage, low enough to blunt scraping/bot swiping.
  - Auth endpoints (`login`, `register`, `refresh`): tight limits (e.g., 5/min) to blunt credential stuffing.
  - Standard reads: generous default (e.g., 300/min).
- Rate-limit state lives in Redis so limits are enforced correctly across all ECS tasks, not per-instance.


---

## 4. Database Schema (PostgreSQL)

### 4.1 Design Notes Before the Schema

- **UUID vs. BIGSERIAL:** Most tables use `UUID` primary keys (via `gen_random_uuid()`, `pgcrypto`/`pgcrypto` built into PG16) because they're safe to generate client-side, don't leak sequential business volume, and merge cleanly across environments. The two genuinely high-write-frequency tables — **`swipes`** and **`messages`** — use `BIGSERIAL` instead, because sequential integer PKs are meaningfully cheaper for index insert performance and storage at high write volume, and neither table's ID is ever exposed as a guessable/sensitive identifier in a way UUIDs would protect against.
- **Polymorphic swipe target, deliberately:** `swipes.target_type` + `target_id` is a polymorphic reference (points at either a `jobs.id` or a `users.id`) rather than two nullable FK columns. This is a conscious trade-off: it keeps the hot-path table narrow (matters at high write volume) at the cost of the database not being able to enforce referential integrity on that column — integrity is enforced at the application layer instead (Section 5). This is called out explicitly in Section 15.
- **`conversations` folded into `matches`:** rather than a separate `conversations` table, `messages.match_id` references `matches.id` directly — a match *is* a conversation thread in this domain (chat only ever exists because of a match, 1:1), so a separate table would be a pure join with no independent lifecycle.
- **Soft state, not soft delete:** most domain tables use a `status` enum column rather than a `deleted_at` timestamp, because "deleted" for a job/match/user is a business state (filled, archived, suspended) with its own transitions, not a binary flag.

### 4.2 Table Definitions

```sql
-- ============================================================
-- USERS — core identity + auth, one row per human account
-- ============================================================
CREATE TYPE user_role AS ENUM ('candidate', 'recruiter', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             CITEXT UNIQUE NOT NULL,
    phone             VARCHAR(20) UNIQUE,
    password_hash     TEXT,                        -- NULL if OAuth-only account
    role              user_role NOT NULL,
    status            user_status NOT NULL DEFAULT 'active',
    email_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role_status ON users (role, status);

-- ============================================================
-- PROFILES — shared display/identity fields for any user
-- ============================================================
CREATE TABLE profiles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name      VARCHAR(120) NOT NULL,
    avatar_url     TEXT,
    bio            TEXT,
    location_city  VARCHAR(100),
    location_country VARCHAR(100),
    location_lat   NUMERIC(9,6),
    location_lng   NUMERIC(9,6),
    timezone       VARCHAR(50) DEFAULT 'UTC',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_location ON profiles (location_city, location_country);

-- ============================================================
-- CANDIDATE_PROFILES — 1:1 extension of profiles for job seekers
-- ============================================================
CREATE TYPE work_mode AS ENUM ('remote', 'hybrid', 'onsite');

CREATE TABLE candidate_profiles (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    headline              VARCHAR(150),
    current_title         VARCHAR(120),
    years_experience      SMALLINT CHECK (years_experience >= 0),
    resume_s3_key         TEXT,                     -- object storage pointer, not the file itself
    resume_parsed_at      TIMESTAMPTZ,
    resume_embedding      VECTOR(768),               -- pgvector; sentence-transformer output
    expected_salary_min   INTEGER,
    expected_salary_max   INTEGER,
    salary_currency       VARCHAR(3) DEFAULT 'INR',
    notice_period_days    SMALLINT,
    preferred_work_mode   work_mode,
    open_to_work          BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_salary_range CHECK (expected_salary_max IS NULL OR expected_salary_max >= expected_salary_min)
);
CREATE INDEX idx_candidate_open_to_work ON candidate_profiles (open_to_work) WHERE open_to_work = true;
CREATE INDEX idx_candidate_embedding_hnsw ON candidate_profiles USING hnsw (resume_embedding vector_cosine_ops);

-- ============================================================
-- RECRUITER_PROFILES — 1:1 extension of profiles for recruiters
-- ============================================================
CREATE TABLE recruiter_profiles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    job_title    VARCHAR(120),
    department   VARCHAR(120),
    is_verified  BOOLEAN NOT NULL DEFAULT false,     -- denormalized from recruiter_verifications for fast reads
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recruiter_company ON recruiter_profiles (company_id);

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TYPE company_size AS ENUM ('1-10','11-50','51-200','201-500','501-1000','1000+');

CREATE TABLE companies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(150) NOT NULL,
    slug          VARCHAR(160) UNIQUE NOT NULL,
    logo_s3_key   TEXT,
    industry      VARCHAR(100),
    company_size  company_size,
    website       VARCHAR(255),
    description   TEXT,
    hq_location   VARCHAR(150),
    verified      BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TYPE employment_type AS ENUM ('full_time','part_time','contract','internship');
CREATE TYPE job_status AS ENUM ('draft','active','paused','filled','closed');

CREATE TABLE jobs (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    posted_by              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title                  VARCHAR(150) NOT NULL,
    description            TEXT NOT NULL,
    employment_type        employment_type NOT NULL,
    work_mode              work_mode NOT NULL,
    location_city          VARCHAR(100),
    location_country       VARCHAR(100),
    salary_min             INTEGER,
    salary_max             INTEGER,
    salary_currency        VARCHAR(3) DEFAULT 'INR',
    experience_min_years   SMALLINT DEFAULT 0,
    notice_period_pref_days SMALLINT,
    status                 job_status NOT NULL DEFAULT 'draft',
    openings               SMALLINT NOT NULL DEFAULT 1 CHECK (openings > 0),
    embedding              VECTOR(768),
    expires_at             TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_job_salary_range CHECK (salary_max IS NULL OR salary_max >= salary_min)
);
CREATE INDEX idx_jobs_status_active ON jobs (status) WHERE status = 'active';
CREATE INDEX idx_jobs_company ON jobs (company_id);
CREATE INDEX idx_jobs_location ON jobs (location_city, location_country);
CREATE INDEX idx_jobs_embedding_hnsw ON jobs USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- SKILLS + junction tables (supporting tables beyond the core 15,
-- needed because skills are genuinely many-to-many)
-- ============================================================
CREATE TABLE skills (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(80) UNIQUE NOT NULL,   -- normalized, lowercase-kebab, e.g. 'react-native'
    category   VARCHAR(50),                    -- 'frontend' | 'backend' | 'data' | 'soft-skill' ...
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE candidate_skills (
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
    skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency  SMALLINT CHECK (proficiency BETWEEN 1 AND 5),
    years_used   SMALLINT,
    source       VARCHAR(20) DEFAULT 'resume_parsed',  -- 'resume_parsed' | 'self_added'
    PRIMARY KEY (candidate_id, skill_id)
);

CREATE TABLE job_skills (
    job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    required     BOOLEAN NOT NULL DEFAULT true,   -- required vs. "nice to have"
    weight       NUMERIC(3,2) DEFAULT 1.00,       -- used by match scoring, Section 7
    PRIMARY KEY (job_id, skill_id)
);

-- ============================================================
-- SWIPES — highest write-frequency table in the system
-- ============================================================
CREATE TYPE swipe_target_type AS ENUM ('job', 'candidate');
CREATE TYPE swipe_direction AS ENUM ('left', 'right');

CREATE TABLE swipes (
    id           BIGSERIAL PRIMARY KEY,
    swiper_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type  swipe_target_type NOT NULL,
    target_id    UUID NOT NULL,                 -- polymorphic: jobs.id OR users.id — see 4.1 note
    job_id       UUID REFERENCES jobs(id) ON DELETE CASCADE,  -- populated when target_type='candidate'
    direction    swipe_direction NOT NULL,
    source       VARCHAR(20) NOT NULL DEFAULT 'deck',
    swiped_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_swipe UNIQUE (swiper_id, target_type, target_id, job_id)
);
CREATE INDEX idx_swipes_target ON swipes (target_type, target_id, direction);
CREATE INDEX idx_swipes_job ON swipes (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_swipes_swiper_time ON swipes (swiper_id, swiped_at DESC);
-- At scale: partition this table by month on swiped_at (Section 14).

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TYPE match_status AS ENUM ('active','closed_hired','closed_rejected','archived');

CREATE TABLE matches (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status       match_status NOT NULL DEFAULT 'active',
    match_score  NUMERIC(5,2),                  -- snapshot at match time, Section 7
    matched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at    TIMESTAMPTZ,
    CONSTRAINT uq_match_candidate_job UNIQUE (candidate_id, job_id)
);
CREATE INDEX idx_matches_candidate ON matches (candidate_id, status);
CREATE INDEX idx_matches_recruiter ON matches (recruiter_id, status);
CREATE INDEX idx_matches_job ON matches (job_id, status);

-- ============================================================
-- MESSAGES — second highest write-frequency table
-- ============================================================
CREATE TYPE message_type AS ENUM ('text','system','attachment');

CREATE TABLE messages (
    id             BIGSERIAL PRIMARY KEY,
    match_id       UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type   message_type NOT NULL DEFAULT 'text',
    content        TEXT,
    attachment_s3_key TEXT,
    read_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_message_content CHECK (content IS NOT NULL OR attachment_s3_key IS NOT NULL)
);
CREATE INDEX idx_messages_match_time ON messages (match_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages (match_id, sender_id) WHERE read_at IS NULL;
-- At scale: partition by month on created_at (Section 14).

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TYPE notification_type AS ENUM
    ('match_created','message_received','interview_proposed',
     'interview_confirmed','job_filled','recruiter_verified','system');

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       notification_type NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',   -- e.g. { "matchId": "...", "senderName": "..." }
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- ============================================================
-- INTERVIEWS
-- ============================================================
CREATE TYPE interview_status AS ENUM
    ('proposed','accepted','rejected','confirmed','completed','cancelled');

CREATE TABLE interviews (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    round             SMALLINT NOT NULL DEFAULT 1,
    proposed_by       UUID NOT NULL REFERENCES users(id),
    status            interview_status NOT NULL DEFAULT 'proposed',
    proposed_slots    JSONB NOT NULL,   -- [{ "start": "...", "end": "...", "timezone": "Asia/Kolkata" }, ...]
    confirmed_start   TIMESTAMPTZ,
    confirmed_end     TIMESTAMPTZ,
    calendar_event_id VARCHAR(255),      -- external calendar (Google/Outlook) event id
    meeting_link      TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interviews_match ON interviews (match_id);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TYPE report_reason AS ENUM
    ('spam','fake_job','harassment','inappropriate_content','scam','other');
CREATE TYPE report_status AS ENUM ('open','reviewing','resolved','dismissed');

CREATE TABLE reports (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_job_id    UUID REFERENCES jobs(id) ON DELETE SET NULL,
    reported_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    reason             report_reason NOT NULL,
    description        TEXT,
    status             report_status NOT NULL DEFAULT 'open',
    resolved_by        UUID REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at        TIMESTAMPTZ,
    CONSTRAINT chk_report_target CHECK (
        reported_user_id IS NOT NULL OR reported_job_id IS NOT NULL OR reported_message_id IS NOT NULL
    )
);
CREATE INDEX idx_reports_status ON reports (status);

-- ============================================================
-- RECRUITER_VERIFICATIONS
-- ============================================================
CREATE TYPE verification_method AS ENUM
    ('work_email_domain','linkedin_oauth','manual_document','admin_override');
CREATE TYPE verification_status AS ENUM ('pending','approved','rejected');

CREATE TABLE recruiter_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    verification_method verification_method NOT NULL,
    work_email          VARCHAR(255),
    document_s3_key      TEXT,
    status               verification_status NOT NULL DEFAULT 'pending',
    reviewed_by          UUID REFERENCES users(id),
    submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at           TIMESTAMPTZ
);
CREATE INDEX idx_verifications_status ON recruiter_verifications (status);

-- ============================================================
-- PREFERENCES
-- ============================================================
CREATE TABLE preferences (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    notify_email       BOOLEAN NOT NULL DEFAULT true,
    notify_push        BOOLEAN NOT NULL DEFAULT true,
    notify_new_match   BOOLEAN NOT NULL DEFAULT true,
    notify_new_message BOOLEAN NOT NULL DEFAULT true,
    deck_filters       JSONB NOT NULL DEFAULT '{}',  -- candidate: {location, remote, salaryMin}; recruiter: default candidate filters
    theme              VARCHAR(20) NOT NULL DEFAULT 'system',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DEVICE_TOKENS — supporting table for push notifications
-- ============================================================
CREATE TYPE device_platform AS ENUM ('ios','android');

CREATE TABLE device_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform   device_platform NOT NULL,
    token      TEXT NOT NULL,
    sns_endpoint_arn TEXT,     -- cached SNS platform endpoint ARN
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_device_token UNIQUE (user_id, token)
);
```

### 4.3 Schema in Plain English

- **`users`** is the root identity table — every login, regardless of role, is one row here. **`profiles`** holds the display fields any human has (name, photo, location), separated from `users` so auth concerns (password, status) stay isolated from public-facing data.
- **`candidate_profiles`** and **`recruiter_profiles`** are role-specific 1:1 extensions of `profiles` — a candidate has a resume, salary expectations, and notice period; a recruiter has a company and a title. A user is never both; the split keeps each table narrow and free of nullable "only applies to one role" columns.
- **`companies`** exist independently of any single recruiter — multiple recruiters can belong to one company, and a company persists even if a recruiter leaves.
- **`jobs`** belong to a company and are posted by a specific recruiter (`posted_by`); status transitions (`draft → active → filled/closed`) drive whether a job appears in candidate decks at all.
- **`skills`** is a shared vocabulary table; **`candidate_skills`** and **`job_skills`** are the many-to-many links that let match scoring compare "what the candidate has" against "what the job needs" without string-matching free text every time.
- **`swipes`** is the append-heavy event log of every swipe from either side. Its polymorphic `target_type`/`target_id` lets one table represent both "candidate swipes on job" and "recruiter swipes on candidate," which is what makes mutual-match detection a single query pattern instead of two separate systems (Section 5).
- **`matches`** is created the moment both sides have swiped right on each other for a given job — it's the pivot the rest of the post-swipe product (chat, interviews) hangs off of.
- **`messages`** belong to a `match` (not a separate conversation entity — see 4.1) and are the durable record chat is built on; Redis only ever handles ephemeral state (typing, presence) around this table.
- **`notifications`** is a generic, typed inbox table — every push/in-app notification the user sees is also durably recorded here, so "notification history" is a plain query, not something reconstructed from SNS logs.
- **`interviews`** hang off a `match` and support multiple rounds (`round` column) with a slot-proposal → confirmation flow captured in `proposed_slots` (JSONB, flexible) and `confirmed_start`/`confirmed_end` (typed, once locked in).
- **`reports`** is a flexible trust & safety table — it can point at a user, a job, or a specific message (the `chk_report_target` constraint requires at least one), covering harassment, fake jobs, and scam messages from one table.
- **`recruiter_verifications`** is intentionally separate from `recruiter_profiles.is_verified` (a denormalized boolean for fast reads) — verification is a workflow with its own status and audit trail (who reviewed it, when), not just a flag.
- **`preferences`** holds notification opt-outs and default deck filters per user; **`device_tokens`** is a small supporting table (not in the original 15, added because push notifications are impossible to implement correctly without it) mapping a user to their APNs/FCM tokens and cached SNS endpoint ARNs.


---

## 5. Swipe & Matching Architecture

This is the highest-frequency, latency-sensitive path in the system, so it deliberately does **not** touch Postgres synchronously on every swipe.

### 5.1 Redis Data Structures

For a given job `J`:

- `swipe:job:{J}:right` — a Redis **Set** of candidate user IDs who swiped right on job `J`.
- `swipe:job:{J}:left` — a Redis **Set** of candidate user IDs who swiped left (kept briefly, mainly to avoid re-showing the card — see 5.5).
- `swipe:candidate:{C}:job:{J}:right` — a simple key (or reuse `swipe:job:{J}:right` membership check) representing "recruiter swiped right on candidate `C` for job `J`".
- `deck:candidate:{C}:seen` — a Redis **Set** of job IDs already shown/swiped by candidate `C`, used to exclude them from future deck queries (TTL'd or trimmed periodically).

### 5.2 Flow: Candidate Swipes Right on a Job

1. Mobile client sends `POST /api/v1/swipes { targetType: 'job', targetId: jobId, direction: 'right' }`.
2. `SwipeService.recordSwipe()` runs **synchronously, in this order**:
   a. `SADD swipe:job:{jobId}:right {candidateId}` — O(1) write to Redis.
   b. `SADD deck:candidate:{candidateId}:seen {jobId}`.
   c. **Mutual check:** `SISMEMBER swipe:candidate:{candidateId}:job:{jobId}:right {recruiter-side flag}` — concretely, check whether *any* recruiter has already swiped right on this candidate for this job: `SISMEMBER swipe:job:{jobId}:recruiter_right:{candidateId}` (a per-candidate-per-job key set when a recruiter swipes right, see 5.3). If true → **match**, proceed to 5.4 synchronously so the client gets the "It's a Match!" response immediately.
   d. If no match yet, respond `200 { matched: false }` immediately — the swipe write itself never waits on Postgres.
3. A lightweight BullMQ job (`flush-swipes`) runs on a short interval (e.g., every 2–5 seconds, or after N buffered swipes) and batch-inserts buffered swipe events into the `swipes` Postgres table via a single multi-row `INSERT ... ON CONFLICT DO NOTHING` (idempotent against the `uq_swipe` constraint), then clears the flushed entries from a Redis list used purely as the flush buffer (distinct from the Sets used for the O(1) membership checks above, which persist longer for cheap re-query).

### 5.3 Flow: Recruiter Swipes Right on a Candidate (for a specific job)

Symmetric to 5.2:

1. `SADD swipe:job:{jobId}:recruiter_right:{candidateId}` marks recruiter interest.
2. Mutual check: `SISMEMBER swipe:job:{jobId}:right {candidateId}` — was this candidate already interested in this job?
3. If true → match (5.4). If false → respond `200 { matched: false }`; buffered flush to Postgres as in 5.2.

### 5.4 Match Creation (Mutual Right Swipe)

When both directions of interest are confirmed (regardless of which side swiped second):

1. **Atomic guard against duplicate match creation:** `SET match:lock:{candidateId}:{jobId} NX EX 10` — a short-lived Redis lock so a race between near-simultaneous requests can't create two match rows. Only the request that acquires the lock proceeds.
2. Synchronous `INSERT INTO matches (candidate_id, recruiter_id, job_id, match_score, status) VALUES (...) ON CONFLICT (candidate_id, job_id) DO NOTHING RETURNING id` — this is the **one** point in the swipe path that writes to Postgres synchronously, because a match is too significant an event to risk losing to a cache flush delay.
3. On successful insert, publish a `match.created` event to SQS with `{ matchId, candidateId, recruiterId, jobId }`.
4. Downstream (async, off the request path):
   - `NotificationService` consumes the event → pushes "It's a Match!" via SNS to both parties' devices and writes a `notifications` row for each.
   - `ChatModule` pre-creates the Socket.io room for `matchId` and both users' active sockets (if connected) are joined immediately.
5. API response to whichever request triggered the match includes `{ matched: true, matchId }` so the client can immediately render the match animation.

### 5.5 Flow: Swipe Left (Either Side)

Left swipes never touch the mutual-match check — they're a pure "don't show me this again" signal:

1. `SADD deck:candidate:{candidateId}:seen {jobId}` (or the recruiter equivalent), so the deck query excludes it going forward.
2. Buffered flush to `swipes` table (same batched writer as right swipes) — kept for scoring/analytics (e.g., "why do candidates reject this job listing") even though it never produces a match.
3. No synchronous Postgres write, no event emitted.

### 5.6 Why This Split (Redis + Postgres + Queue)

| Concern | Handled by | Why |
|---|---|---|
| Sub-10ms mutual-match check on every swipe | Redis `SISMEMBER`/`SADD` | Postgres, even indexed, cannot match Redis's in-memory O(1) set operations at this write frequency without meaningfully higher latency and connection-pool pressure. |
| Durable system-of-record for swipe history | Postgres `swipes` table (batched writes) | Analytics, match-scoring recomputation, and abuse detection all need durable, queryable history — Redis Sets alone don't give you "when did this swipe happen" or support ad-hoc SQL. |
| Guaranteed-once match creation | Postgres `matches` table + `uq_match_candidate_job` constraint + Redis lock | A match is a business-critical event; it must be exactly-once and crash-safe, which is exactly what a relational unique constraint + transaction guarantees and a cache does not. |
| Fan-out after a match (push, chat room, email) | SQS + async workers | None of this needs to block the swiping user's next card from loading; decoupling it keeps p99 swipe latency flat regardless of notification-provider latency. |

### 5.7 Deck Ranking (What Card Comes Next)

The "deck" endpoint (`GET /api/v1/candidates/deck`) is not a plain unfiltered list — it excludes `deck:candidate:{id}:seen` job IDs, filters by the candidate's `preferences.deck_filters` (location, remote, salary floor), and orders by a lightweight relevance score (Section 7's match score, computed incrementally, not the full pipeline on every request — see 7.4 for the caching strategy). At MVP scale this query runs directly against Postgres with the `idx_jobs_status_active` and `idx_jobs_embedding_hnsw` indexes; once OpenSearch is introduced (Section 8), deck ranking migrates to it for candidates/jobs with large catalogs.


---

## 6. Resume Processing Pipeline

### 6.1 Pipeline Overview

```
Mobile App
   │ 1. Request presigned S3 PUT URL
   ▼
Core API (ProfileModule)
   │ 2. Returns presigned URL (S3 PutObject, 5 min TTL, content-type restricted to PDF/DOCX)
   ▼
Mobile App  ──uploads directly──►  S3 (private bucket: swipehire-resumes-raw)
   │ 3. On upload complete, client calls
   │    POST /api/v1/candidates/resume  { s3Key }
   ▼
Core API
   │ 4. Writes candidate_profiles.resume_s3_key, publishes `resume.uploaded` to SQS
   ▼
SQS (resume-processing queue)
   │
   ▼
Async Worker (consumes queue)
   │ 5. Triggers malware scan
   ▼
S3 Object Lambda / ClamAV-on-Lambda scan
   │  - Clean   → tag object `scan-status=clean`, continue
   │  - Infected → tag `scan-status=infected`, quarantine, notify candidate, STOP
   ▼
Async Worker
   │ 6. Calls Python NLP Service (internal HTTP) with { s3Key }
   ▼
Python NLP Service (FastAPI)
   │ 7. Downloads object from S3 (private, IAM role-scoped access)
   │ 8. Text extraction (pdfplumber / python-docx depending on file type)
   │ 9. Skill + entity extraction:
   │      - Deterministic pass: spaCy NER + a curated skills-taxonomy matcher
   │        (fast, cheap, handles the common well-formatted resume)
   │      - LLM fallback pass: only triggered if deterministic confidence is low
   │        (e.g., unusual formatting, non-standard resume) — structured-extraction
   │        prompt against Claude (via Bedrock) constrained to a JSON schema
   │ 10. Generate a 768-dim embedding of the parsed resume text (sentence-transformer)
   │ 11. Returns structured JSON: { skills[], experience[], education[],
   │        totalYearsExperience, currentTitle, embedding[768] }
   ▼
Async Worker
   │ 12. Persists structured output:
   │       - candidate_skills rows (skill_id + proficiency inferred from years/context)
   │       - candidate_profiles.years_experience, current_title, resume_embedding, resume_parsed_at
   │ 13. Publishes `resume.parsed` event → triggers match-score recomputation (Section 7)
   │       and search-index update (Section 8)
   ▼
Mobile App
   │ 14. Push notification: "Your profile is ready — review your auto-filled details"
   ▼
   Candidate reviews/edits the auto-filled profile (human-in-the-loop correction,
   per the product's own onboarding flow) before it goes live in recruiter decks.
```

### 6.2 Why This Shape

- **Direct-to-S3 upload (presigned URL), not through the API server:** avoids streaming a multi-MB file through NestJS just to re-upload it — the app server's job is authorization and metadata, not file bytes.
- **Malware scan before parsing, not after:** the NLP service downloads and opens/parses the file; scanning first means a malicious file is never handed to a parsing library.
- **Deterministic-first, LLM-fallback-second extraction:** the large majority of resumes are well-structured enough for a fast, cheap, deterministic pipeline (spaCy NER + skills taxonomy matching); reserving the LLM call for genuinely ambiguous documents keeps average cost and latency low while still handling messy real-world resumes correctly.
- **The candidate reviews the auto-filled profile before it's live** — this isn't just good UX, it's a data-quality control: NLP extraction is never presented as ground truth without a human confirmation step, which directly improves match-scoring accuracy downstream.
- **Everything past step 4 is async** — the candidate's upload request returns as soon as the file lands in S3 and the event is queued; parsing never blocks the mobile UI.

### 6.3 Python NLP Service — Endpoint Shape

```
POST /internal/v1/parse-resume
Body: { "s3Key": "resumes/raw/{candidateId}/{uuid}.pdf" }
Response: {
  "skills": [{ "name": "react-native", "confidence": 0.94 }, ...],
  "experience": [{ "title": "...", "company": "...", "startDate": "...", "endDate": "...", "description": "..." }],
  "education": [{ "degree": "...", "institution": "...", "year": 2024 }],
  "totalYearsExperience": 2.5,
  "currentTitle": "Full Stack Developer",
  "embedding": [0.0123, -0.0456, ...],   // length 768
  "extractionMethod": "deterministic" | "llm_fallback",
  "confidence": 0.91
}
```

The service is stateless, horizontally scalable behind its own ECS Fargate service, and never writes to Postgres directly — persistence is always the calling worker's responsibility, keeping the NLP service reusable (e.g., it could later also power job-description parsing with no schema coupling).


---

## 7. Match Scoring System

Match scoring must be **transparent, not a black box** — both the candidate and recruiter should be able to see roughly *why* something is a strong match, not just a bare percentage.

### 7.1 Scoring Factors and Weights (MVP defaults, tunable)

| Factor | Weight | How it's computed |
|---|---|---|
| **Skills overlap** | 35% | Weighted Jaccard-style overlap between `candidate_skills` and `job_skills`, where required skills (`job_skills.required = true`) count more than "nice to have," using `job_skills.weight`. |
| **Semantic similarity** | 20% | Cosine similarity between `candidate_profiles.resume_embedding` and `jobs.embedding` (both `VECTOR(768)`, compared via `pgvector`'s `<=>` operator) — catches relevant experience that skill-tag matching misses (e.g., "built a recommendation engine" implying ML skills not explicitly tagged). |
| **Experience fit** | 15% | Piecewise function of `candidate_profiles.years_experience` vs. `jobs.experience_min_years` — full score at/above minimum, tapering down below it (not a hard cutoff, since a strong candidate slightly under the stated minimum is still worth surfacing at a lower score rather than excluded outright). |
| **Location / work mode fit** | 10% | Exact match on `work_mode` (remote/hybrid/onsite) scores full; city/country proximity scores partial for onsite/hybrid roles; remote-remote is always full regardless of location. |
| **Salary alignment** | 10% | Overlap between `candidate_profiles.expected_salary_min/max` and `jobs.salary_min/max` ranges — full score if ranges overlap meaningfully, tapering as the gap grows. |
| **Notice period fit** | 5% | How close `candidate_profiles.notice_period_days` is to `jobs.notice_period_pref_days` — shorter-than-preferred scores full, longer tapers down. |
| **Role/title relevance** | 5% | Text similarity between `candidate_profiles.current_title` and `jobs.title` (lightweight, embedding-based, reuses the same vectors as semantic similarity rather than a separate model). |

**Formula:** `match_score = Σ (factor_score_i × weight_i)`, normalized to a **0–100 integer percentage** for display. Each factor score is itself 0.0–1.0 before weighting.

### 7.2 Transparency in Practice

The API response for a deck card / match includes a breakdown, not just the final number:

```json
{
  "matchScore": 87,
  "breakdown": [
    { "factor": "skills", "score": 92, "weight": 35, "detail": "8 of 9 required skills matched" },
    { "factor": "semanticSimilarity", "score": 81, "weight": 20 },
    { "factor": "experience", "score": 100, "weight": 15, "detail": "3.5 yrs vs. 2 yr minimum" },
    { "factor": "location", "score": 100, "weight": 10, "detail": "Remote — always full match" },
    { "factor": "salary", "score": 70, "weight": 10, "detail": "Overlapping but near your floor" },
    { "factor": "noticePeriod", "score": 80, "weight": 5 },
    { "factor": "roleRelevance", "score": 75, "weight": 5 }
  ]
}
```

This gives the frontend enough to show a genuinely useful "why this match" expandable panel rather than an opaque percentage — directly satisfying the "don't make it a black box" requirement.

### 7.3 Where the Score Is Calculated and Stored

- **Deck-time (cheap, cached):** when generating a swipe deck, a **precomputed** score is read, not recalculated per request. Full recomputation on every deck fetch (which can be dozens of cards per session) would be wasteful; scores are recomputed only when meaningfully stale (see 7.4).
- **Match-time (authoritative snapshot):** the moment a `matches` row is created (Section 5.4), the current score is computed fresh and stored in `matches.match_score` — this is a **permanent snapshot**, not a live-recomputed value, so a match's displayed score doesn't drift confusingly after the fact even if one side edits their profile later.
- **Storage:** a `candidate_job_scores` supporting table (candidate_id, job_id, score, breakdown JSONB, computed_at) acts as the deck-time cache, populated by the same async worker that handles `resume.parsed` and `job.created`/`job.updated` events, keyed by a composite index on `(candidate_id, job_id)`.

### 7.4 Recomputation Triggers

Scores are recomputed asynchronously (never inline in a request) when:
- A candidate's resume is (re)parsed (`resume.parsed` event).
- A candidate manually edits skills/preferences.
- A job is created or its requirements are edited.
- A weekly batch job recomputes stale scores older than N days, to account for drift not tied to a specific event (e.g., a job simply aging).


---

## 8. Search & Discovery

While the primary candidate/recruiter experience is the swipe deck (ranking-driven, Section 5.7), a **search & discovery** surface is needed for recruiters actively hunting for specific candidates and for candidates browsing beyond their default deck — this is a distinct access pattern (explicit filters, not implicit ranking) and is best served by a dedicated search engine rather than stretching Postgres queries to do faceted full-text search.

### 8.1 Why OpenSearch (not just Postgres)

Postgres full-text search (`tsvector`/`tsquery`) is genuinely sufficient at MVP scale for simple keyword search, and is the **MVP-day-one default** to avoid standing up and operating an extra managed service before it's needed. OpenSearch is designed in from the start and introduced once any of these become true: filter combinations get complex enough that Postgres query plans degrade, facet/aggregation needs grow (e.g., "show me skill distribution across results"), or search traffic volume alone starts contending with transactional query load on the primary database.

### 8.2 Index Design

Two indices, mirroring the two discovery directions:

**`jobs_index`** (searched by candidates)
```json
{
  "jobId": "uuid", "title": "text", "companyName": "text", "skills": ["keyword"],
  "locationCity": "keyword", "locationCountry": "keyword", "workMode": "keyword",
  "salaryMin": "integer", "salaryMax": "integer", "employmentType": "keyword",
  "experienceMinYears": "integer", "industry": "keyword", "status": "keyword",
  "createdAt": "date", "embedding": "knn_vector (768, cosine)"
}
```

**`candidates_index`** (searched by recruiters — only candidates with `open_to_work = true` are indexed)
```json
{
  "candidateId": "uuid", "headline": "text", "currentTitle": "text", "skills": ["keyword"],
  "yearsExperience": "integer", "locationCity": "keyword", "locationCountry": "keyword",
  "preferredWorkMode": "keyword", "expectedSalaryMin": "integer", "expectedSalaryMax": "integer",
  "noticePeriodDays": "integer", "openToWork": "boolean", "embedding": "knn_vector (768, cosine)"
}
```

### 8.3 Indexing Pipeline

Postgres remains the system of record; OpenSearch is a **derived, eventually-consistent read index**, kept in sync by the same async-worker pattern used elsewhere:

`job.created` / `job.updated` / `candidate.profile_updated` / `resume.parsed` events (SQS) → **Search Indexing Worker** → upserts the corresponding OpenSearch document. A nightly full-reindex job exists as a consistency backstop for anything a missed event might have skipped.

### 8.4 Query Pattern

A search request combines **filters** (exact/range, e.g., `workMode: remote`, `salaryMin >= 800000`, `noticePeriodDays <= 30`) with **relevance scoring** (BM25 text match on title/skills, optionally boosted or blended with k-NN vector similarity for semantic queries like "someone who's basically done this job before"). OpenSearch's `bool` query with `filter` (non-scoring, cached, fast) + `should`/`knn` (scoring) clauses maps directly onto this.


---

## 9. Real-Time Chat

Chat is **gated entirely by match state** — there is no direct-message path in this product; every conversation exists because `matches` produced it.

### 9.1 Connection Lifecycle

1. On app foreground / login, the mobile client opens a Socket.io connection to the Chat Gateway, authenticating with the current JWT access token in the handshake.
2. On successful auth, the server queries `matches` for all `active` matches involving this user and joins the socket to a room per `matchId` (`socket.join('match:' + matchId)`).
3. If the token expires mid-session, the client silently refreshes via the REST refresh endpoint and reconnects — Socket.io's reconnection logic handles this as a normal disconnect/reconnect cycle.

### 9.2 Conversation Creation

There is no separate "create conversation" call — a conversation implicitly exists the instant a `matches` row is created (Section 5.4). The Chat Gateway subscribes to the internal `match.created` event and proactively joins both users' currently-connected sockets (if any) to the new room, so chat is available with zero additional client action beyond the match itself.

### 9.3 Message Delivery

```
Client A ──emit('message:send', { matchId, content }) ──► Chat Gateway
                                                                │
                                                    1. Validate: is sender an active
                                                       participant of this match?
                                                    2. INSERT INTO messages (...)  [Postgres]
                                                    3. io.to('match:'+matchId).emit('message:new', msg)
                                                                │
                                        ┌───────────────────────┴───────────────────────┐
                                        ▼                                               ▼
                          Client B (connected, in room)                    Client A (own echo, for optimistic-UI reconciliation)
```

Message persistence happens **before** broadcast (write-then-fan-out), so a message is never emitted to a recipient that isn't durably stored — if the DB write fails, the client gets an error/retry, not a phantom message the recipient sees but the sender's history doesn't have.

### 9.4 Read Status

- Client emits `message:read { matchId, upToMessageId }` when the conversation is opened/scrolled into view.
- Server updates `messages.read_at = now()` for all messages in that match up to and including that ID, sent by the *other* party (a user can't mark their own messages read).
- Server emits `message:read:ack { matchId, upToMessageId, readBy }` to the room so the sender's client can render the double-check/read receipt.

### 9.5 Presence & Typing Indicators

Presence and typing state are **Redis-only, never persisted to Postgres** — they're inherently ephemeral and don't need durability or history:

- `SET presence:{userId} online EX 60` (renewed on heartbeat/activity); absence of the key = offline.
- `typing:{matchId}:{userId}` key with a short TTL (e.g., 5s), set on a `typing:start` event and allowed to naturally expire — the recipient's client shows the indicator while the key is watched/polled or, more efficiently, driven directly by the `typing:start`/`typing:stop` socket events themselves (Redis TTL here mainly guards against a client that disconnects mid-typing without sending `typing:stop`).

### 9.6 Push Notifications for Messages

If the recipient's socket isn't connected (app backgrounded/closed) at broadcast time, the Chat Gateway publishes a `message.undelivered` event to SQS instead of relying on the WebSocket, which the Notification Service turns into an APNs/FCM push — this is why message delivery (9.3) and push notification are two separate mechanisms rather than one, since a WebSocket emit to a disconnected socket simply goes nowhere.

### 9.7 Redis Scaling for WebSockets

`socket.io-redis-adapter` uses Redis pub/sub so that `io.to('match:'+matchId).emit(...)` reaches sockets connected to **any** ECS task, not just the task that received the originating request — this is what allows the Chat Gateway to run N horizontally-scaled instances behind the ALB (with sticky sessions only mattering for the *initial* HTTP upgrade handshake, not for message routing, since the Redis adapter handles cross-instance fan-out regardless of which instance a given socket is attached to).


---

## 10. Interview Scheduling

### 10.1 Flow

```
1. PROPOSE
   Recruiter: POST /api/v1/interviews/{matchId}/propose
              { round: 1, proposedSlots: [{start, end, timezone}, ...] }
   → INSERT INTO interviews (status='proposed', proposed_by=recruiterId, proposed_slots=[...])
   → publish `interview.proposed` → push + in-app notification to candidate
   → system message auto-posted in chat: "Interview slots proposed — view details"

2. RESPOND
   Candidate: POST /api/v1/interviews/{id}/respond
              { action: 'accept' | 'reject', selectedSlot?: {...} }
   → if accept: status → 'accepted', confirmed_start/confirmed_end set from selectedSlot
   → if reject: status → 'rejected'; recruiter is notified and may propose new slots
      (a new `interviews` row for the next round, round += 1 — history is preserved,
       not overwritten)

3. CONFIRM
   On 'accepted', an async worker:
     a. Creates a calendar event via the Calendar Integration (Google Calendar API /
        Microsoft Graph, OAuth-linked per recruiter) and stores the returned
        calendar_event_id
     b. Generates/attaches a meeting_link (video conferencing provider, or a
        simple generated room link at MVP)
     c. Updates status → 'confirmed'
     d. Publishes `interview.confirmed` → notifies both parties (push + email via SES)
        with calendar `.ics` attachment as a fallback for non-OAuth-linked candidates

4. NOTIFICATIONS
   Reminder jobs (scheduled via SQS delay queues or EventBridge Scheduler) fire
   24h and 1h before confirmed_start.

5. OUTCOME
   After the interview, recruiter marks status → 'completed', and separately
   updates the related `matches.status`:
     - 'closed_hired'   → also triggers jobs.openings decrement; if openings
                           reaches 0, jobs.status → 'filled'
     - 'closed_rejected'→ candidate notified with an optional feedback prompt
```

### 10.2 Interview Status State Machine

```
proposed ──accept──► accepted ──(auto)──► confirmed ──► completed
    │                                                        
    └──reject──► rejected  (recruiter may propose a new round)
    
Any non-terminal state ──► cancelled  (either party, with reason logged)
```

### 10.3 Calendar Integration Notes

- Recruiters OAuth-link their calendar (Google/Microsoft) once during onboarding; the access/refresh tokens are stored encrypted (KMS-encrypted column or Secrets Manager reference, never plaintext) and scoped to calendar-write-only permissions.
- Candidates are not required to link a calendar — they receive a `.ics` file via email/push as a universal fallback, keeping the feature usable without forcing an OAuth grant on the candidate side, which would add friction to the funnel for the side of the marketplace with lower average intent-per-session.


---

## 11. AWS Architecture (MVP vs. Scale)

### 11.1 MVP Architecture (launch-ready, cost-conscious)

| Service | MVP Configuration |
|---|---|
| **Compute** | ECS Fargate — 2 services minimum: `core-api` (NestJS monolith, includes Core/Matching/Chat/Interview/Notification modules) and `nlp-service` (FastAPI). 1–2 tasks each, behind one ALB. No separate Matching/Chat services yet — they're logical modules within `core-api` (Section 3.1). |
| **Database** | RDS PostgreSQL, single `db.t4g.medium` (or equivalent burstable) instance, Multi-AZ **off** at absolute MVP, single read replica added as soon as real traffic lands. `pgvector` extension enabled from day one. |
| **Cache** | ElastiCache Redis, single-node `cache.t4g.small`, no cluster mode — sufficient for swipe-buffer/session/presence load at MVP volume. |
| **Search** | **Deferred at absolute day-one MVP** — Postgres `tsvector` full-text search covers basic keyword search; OpenSearch is added the moment filter/facet complexity or query volume justifies it (Section 8.1), not before, since it's the single most operationally expensive piece to run "just in case." |
| **Storage** | S3 — two buckets minimum: `swipehire-resumes` (private, versioned, lifecycle rule to Glacier for very old unused resumes) and `swipehire-media` (avatars/logos, served via CloudFront). |
| **Queue** | SQS — one standard queue per event type initially (`resume-processing`, `notifications`, `search-indexing`), each with a DLQ. FIFO reserved only for anything requiring strict ordering (none is strictly required at MVP). |
| **Real-time** | Socket.io on the same `core-api` Fargate service at MVP (chat traffic is low relative to swipe traffic early on); split into a dedicated `chat-gateway` service only once WebSocket connection count justifies independent scaling. |
| **CDN** | CloudFront in front of S3 media and the API's static/cacheable responses. |
| **Notifications** | SNS (mobile push) + SES (email), both pay-per-use — no fixed cost at low volume. |
| **Networking** | Single VPC, public subnets for ALB/NAT, private subnets for ECS tasks + RDS + ElastiCache (never publicly reachable). |
| **DNS/TLS** | Route 53 + ACM (free, auto-renewing certs). |

### 11.2 Scale Architecture (post-traction)

| Concern | Scaling move |
|---|---|
| Compute | Split the monolith along its existing module boundaries (Section 3.1) into independently deployed ECS services (`core-api`, `matching-service`, `chat-gateway`, `notification-service`) — each scales on its own metric (chat scales on concurrent WS connections, matching scales on request rate, not the same curve). |
| Database | RDS Multi-AZ (automatic failover) + read replicas for read-heavy endpoints (deck browsing, search fallback); `swipes` and `messages` tables partitioned by month (Section 14). |
| Cache | ElastiCache Redis **cluster mode enabled**, sharded by key prefix, so swipe-buffer load for one hot job listing can't bottleneck the whole cache. |
| Search | OpenSearch multi-node cluster, dedicated master nodes, index lifecycle management for the swipe-derived indices. |
| Real-time | `chat-gateway` becomes its own Fargate service with its own auto-scaling policy on active WebSocket connection count; Redis adapter cluster dedicated to pub/sub, separate from the general-purpose cache cluster. |
| Async processing | SQS queues split further per event type with per-type worker auto-scaling (`resume-processing` bursts around peak upload hours need different scaling than steady-state `notifications`). |
| Global reach | Multi-region read replicas / CloudFront edge for latency-sensitive markets, if the product expands beyond one primary geography. |

### 11.3 Explicit MVP vs. Scale Line

The rule applied throughout this document: **every service is designed for so schema/API contracts don't need rework later, but only services with a clear MVP-day-one cost (Postgres, Redis, S3, SQS, SNS/SES, one compute service) are actually provisioned at launch.** OpenSearch, a dedicated Chat Gateway service, Redis cluster mode, and RDS Multi-AZ are all real, planned additions — not afterthoughts — but they're triggered by measured need (traffic, connection count, uptime SLA), not provisioned speculatively.


---

## 12. Environment & Configuration

### 12.1 Environments

| Environment | Purpose | Infra notes |
|---|---|---|
| **Development** | Local development, docker-compose for Postgres/Redis/(optionally OpenSearch), SQS mocked via BullMQ or LocalStack | Seed data scripts; NLP service runs the deterministic pipeline only (no live LLM calls by default, to keep local dev free/offline-friendly) |
| **Staging** | Mirrors production topology at smaller instance sizes; used for QA, pre-release mobile builds (TestFlight/Play internal track), and integration testing against real AWS managed services | Separate AWS account or strictly isolated VPC from production; synthetic/anonymized data only |
| **Production** | Live traffic | Multi-AZ where applicable, full monitoring/alerting, restricted deploy access |

### 12.2 Required Environment Variables

```
# --- Database ---
DATABASE_URL                  # never hardcoded — injected via ECS task secrets (Secrets Manager)
DATABASE_POOL_MAX

# --- Redis ---
REDIS_URL                     # Secrets Manager

# --- Auth ---
JWT_ACCESS_SECRET             # Secrets Manager, rotated
JWT_REFRESH_SECRET            # Secrets Manager, rotated
JWT_ACCESS_EXPIRY             # e.g. "15m"
JWT_REFRESH_EXPIRY            # e.g. "30d"
OAUTH_GOOGLE_CLIENT_ID
OAUTH_GOOGLE_CLIENT_SECRET    # Secrets Manager
OAUTH_LINKEDIN_CLIENT_ID
OAUTH_LINKEDIN_CLIENT_SECRET  # Secrets Manager

# --- AWS ---
AWS_REGION
S3_BUCKET_RESUMES
S3_BUCKET_MEDIA
SQS_QUEUE_RESUME_PROCESSING
SQS_QUEUE_NOTIFICATIONS
SQS_QUEUE_SEARCH_INDEXING
SNS_PLATFORM_APP_ARN_IOS
SNS_PLATFORM_APP_ARN_ANDROID
# Note: AWS credentials themselves are NEVER set as env vars in ECS —
# tasks assume an IAM Task Role; this list is ARNs/identifiers only.

# --- OpenSearch (once introduced) ---
OPENSEARCH_ENDPOINT
OPENSEARCH_INDEX_JOBS
OPENSEARCH_INDEX_CANDIDATES

# --- NLP Service ---
NLP_SERVICE_INTERNAL_URL
LLM_API_KEY                   # Secrets Manager — used only for the fallback extraction path
EMBEDDING_MODEL_NAME

# --- Notifications ---
SES_FROM_EMAIL

# --- Observability ---
SENTRY_DSN
LOG_LEVEL
OTEL_EXPORTER_ENDPOINT

# --- App ---
NODE_ENV                      # development | staging | production
PORT
API_BASE_URL
CORS_ALLOWED_ORIGINS
```

### 12.3 What Must Never Be Hardcoded

- **All secrets** (DB credentials, JWT signing secrets, OAuth client secrets, LLM API keys, SES/SNS-adjacent credentials) — sourced exclusively from **AWS Secrets Manager** (or SSM Parameter Store for non-secret config), injected into ECS tasks at runtime via task definition secret references, never baked into container images or committed to the repo.
- **AWS credentials** — ECS tasks use **IAM Task Roles**, not static access keys; the Python NLP service and Node workers authenticate to S3/SQS/SNS purely via the role attached to their task, so there is no `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` anywhere in the system.
- **Environment-specific URLs/ARNs** — differ per environment (dev/staging/prod) and are injected per ECS task definition / per `.env` file (git-ignored) locally, never assumed via a shared config file checked into version control.
- **Third-party API keys** (LLM provider, calendar OAuth secrets) — Secrets Manager, with staging and production using **separate** credentials/quotas so a staging bug can't exhaust a production rate limit or budget.


---

## 13. Folder Structure

### 13.1 React Native Frontend

```
swipehire-mobile/
├── src/
│   ├── app/                    # App entry, navigation container, root providers
│   │   ├── navigation/          # React Navigation stacks (Auth, CandidateTabs, RecruiterTabs)
│   │   └── App.tsx
│   ├── features/                # Feature-first organization (mirrors backend modules)
│   │   ├── auth/                 # login, register, biometric unlock
│   │   ├── onboarding/           # role selection, resume upload, preferences setup
│   │   ├── deck/                  # swipe card UI, gesture handling (Reanimated + Gesture Handler)
│   │   ├── matches/                # match list, match animation
│   │   ├── chat/                    # conversation list, message thread, Socket.io client hook
│   │   ├── interviews/               # slot proposal/response UI, calendar view
│   │   ├── profile/                   # profile view/edit (candidate + recruiter variants)
│   │   └── notifications/              # in-app notification center
│   ├── components/               # Shared, cross-feature UI primitives (Button, Card, Avatar, ...)
│   ├── hooks/                     # Shared hooks (useAuth, useSocket, useDeck)
│   ├── services/                   # API client (typed, shared DTOs), socket client, storage (Keychain)
│   ├── store/                       # State management (e.g., Zustand/Redux Toolkit) — auth, deck queue, chat cache
│   ├── theme/                        # Design tokens, typography, spacing
│   └── types/                         # Shared TypeScript types (ideally imported from a shared package with backend DTOs)
├── ios/                            # Native iOS project (CocoaPods, entitlements for push)
├── android/                        # Native Android project (Gradle, FCM config)
├── __tests__/
└── package.json
```

### 13.2 NestJS Backend (`core-api`)

```
swipehire-api/
├── src/
│   ├── main.ts                       # Bootstrap, global pipes/filters/interceptors
│   ├── app.module.ts                  # Root module, wires all feature modules
│   ├── common/                         # Cross-cutting concerns
│   │   ├── guards/                       # JwtAuthGuard, RolesGuard, OwnershipGuard
│   │   ├── filters/                       # AllExceptionsFilter
│   │   ├── interceptors/                   # Logging, response envelope
│   │   ├── decorators/                      # @Roles(), @CurrentUser()
│   │   └── pipes/                            # Custom validation pipes
│   ├── config/                          # Typed config module (reads/validates env vars at boot)
│   ├── modules/
│   │   ├── auth/                         # AuthModule — controllers, service, DTOs, Passport strategies
│   │   ├── profile/                       # ProfileModule
│   │   ├── company/                        # CompanyModule
│   │   ├── job/                             # JobModule
│   │   ├── swipe-match/                      # SwipeMatchModule — swipe.controller, match.service, redis-swipe.repository
│   │   ├── chat/                              # ChatModule — chat.gateway.ts (Socket.io), message.service
│   │   ├── interview/                          # InterviewModule
│   │   ├── notification/                        # NotificationModule — sns.adapter, ses.adapter
│   │   ├── report/                                # ReportModule
│   │   └── search/                                 # SearchModule — opensearch.client, search.service
│   ├── database/
│   │   ├── entities/                        # TypeORM/Prisma models, 1:1 with Section 4 tables
│   │   ├── migrations/
│   │   └── seeds/
│   ├── queue/                              # SQS/BullMQ producers + consumers, per event type
│   └── shared/                              # Shared DTOs/types (published as a package consumed by mobile app)
├── test/
├── docker-compose.yml                    # Local Postgres, Redis, LocalStack
└── package.json
```

### 13.3 Python NLP Service

```
swipehire-nlp-service/
├── app/
│   ├── main.py                    # FastAPI app entry, router registration
│   ├── api/
│   │   └── v1/
│   │       └── resume.py           # POST /internal/v1/parse-resume
│   ├── core/
│   │   ├── config.py                # Pydantic Settings, env var loading
│   │   └── logging.py
│   ├── services/
│   │   ├── extraction/               # Deterministic pipeline (spaCy pipeline, skills taxonomy matcher)
│   │   ├── llm_fallback/              # Structured-extraction prompt + Bedrock/Claude client
│   │   ├── embeddings/                 # Sentence-transformer wrapper
│   │   └── s3_client.py
│   ├── models/                     # Pydantic request/response schemas
│   └── data/
│       └── skills_taxonomy.json     # Curated skill vocabulary/synonyms
├── tests/
├── Dockerfile
└── requirements.txt
```


---

## 14. Scalability

| Load dimension | Bottleneck if naive | Mitigation in this architecture |
|---|---|---|
| **Thousands of concurrent users** | Single-instance app server saturates connections/CPU | ECS Fargate auto-scaling on CPU/memory + request count per target; ALB distributes across tasks; RDS connection pooling via PgBouncer (or RDS Proxy) so scaled-out app instances don't each hold excessive direct DB connections. |
| **Large volume of swipes** | Every swipe as a synchronous Postgres write becomes the ceiling on swipe throughput | Redis absorbs the write-frequency (Section 5); Postgres only receives batched, buffered inserts — throughput ceiling moves from "Postgres write IOPS" to "Redis ops/sec," which is orders of magnitude higher on the same hardware class. At real scale, `swipes` is **range-partitioned by month** on `swiped_at`, keeping each partition's indexes small and vacuum/maintenance cheap. |
| **High chat traffic** | Single WebSocket server caps concurrent connections; cross-instance message delivery breaks without coordination | `chat-gateway` split into its own horizontally-scaled Fargate service (Section 11.2) with `socket.io-redis-adapter` for cross-instance fan-out; `messages` partitioned by month, matching the `swipes` pattern, keeping hot-partition writes/reads fast regardless of total historical message volume. |
| **Resume processing bursts** | A spike in signups (e.g., a marketing push) floods the NLP service and blocks the queue | SQS naturally buffers bursts (no dropped work, just queued); `nlp-service` ECS tasks auto-scale on `ApproximateNumberOfMessagesVisible` in the resume-processing queue; the deterministic-first extraction path (Section 6.2) keeps the *common* case cheap so burst capacity planning is dominated by the fast path, not the LLM fallback path. |
| **Search traffic** | Postgres full-text queries contend with transactional OLTP load under heavy search usage | OpenSearch is introduced specifically to move this read pattern off the primary database entirely (Section 8); OpenSearch itself scales by adding data nodes and increasing shard count per index. |
| **Notification bursts** (e.g., many matches at once during peak swipe hours) | Synchronous push-sending inline with match creation slows the swipe path | Fan-out is always async via SQS (Section 5.4, 5.6); `notification-service` scales independently and SNS itself absorbs high publish throughput without backpressure on the app. |
| **Database as the eventual shared bottleneck** | Every mitigation above still funnels durable writes through one Postgres primary | Read replicas absorb read-heavy endpoints (deck browsing fallback, analytics); Multi-AZ failover protects availability; partitioning (swipes, messages) keeps write-heavy tables' indexes and vacuum cost bounded as volume grows; if a single primary ever becomes the genuine ceiling (well past MVP), the modular monolith's existing service boundaries (Section 3.1) are exactly where a schema-per-service split would happen next. |

### 14.1 The General Pattern

Every scaling lever above follows the same principle established in Section 2: **keep the user-facing request path short and push everything that can happen "a moment later" onto a queue.** The system's actual throughput ceiling at MVP scale is Redis (extremely high) and SQS (extremely high) for the hot paths, with Postgres write throughput — the traditionally hardest thing to scale — deliberately kept off the critical path for the highest-frequency operations (swipes) and only in the critical path for genuinely low-frequency, high-value operations (match creation, interview confirmation).

---

## 15. Architecture Decision Log

| # | Decision | Problem it solves | Alternative considered | Reconsider when |
|---|---|---|---|---|
| 1 | **NestJS modular monolith** (not microservices from day one) | One deployable, one CI/CD pipeline, no distributed-systems tax (network calls, distributed tracing, service discovery) for a small team building an MVP | Microservices per domain from the start | Team grows past ~6–8 backend engineers, or one module's scaling/deploy cadence genuinely diverges from the rest (chat is the most likely first candidate, per Section 11.2) |
| 2 | **Redis as the swipe hot path, Postgres as durable record** | Sub-10ms mutual-match detection at high write frequency without overloading the relational DB | All-Postgres with aggressive indexing | Never fully — this split is a permanent architectural feature, not an MVP shortcut; what changes over time is Redis's deployment topology (single-node → cluster mode) |
| 3 | **Polymorphic `swipes.target_type`/`target_id`** (no DB-enforced referential integrity on that column) | Keeps the highest-write-frequency table narrow and fast to insert into | Two nullable FK columns (`job_id_target`, `candidate_id_target`) with DB-enforced integrity | If data-integrity bugs from the app-layer enforcement actually surface in practice, revisit — the two-nullable-FK alternative is a straightforward, low-risk migration if needed |
| 4 | **PostgreSQL + `pgvector`** for embeddings (not a dedicated vector DB) | One database to operate at MVP scale; transactional consistency between relational profile data and its embedding | Pinecone / Weaviate / a dedicated vector store | Embedding volume or k-NN query latency/throughput genuinely outgrows what `pgvector`'s HNSW index handles well on the primary DB instance class |
| 5 | **OpenSearch deferred past absolute MVP day-one** | Avoids operating an extra stateful, non-trivial-to-run service before search complexity justifies it | Stand up OpenSearch from day one "to be safe" | Filter/facet complexity, query volume, or Postgres query-plan degradation makes this necessary (Section 8.1) — designed for from the start so this is a config/deploy change, not a schema rewrite |
| 6 | **Deterministic-first, LLM-fallback resume parsing** | Keeps average parsing cost and latency low while still handling messy resumes | LLM-only extraction for every resume | If deterministic-pipeline accuracy proves consistently poor in practice (would show up as high candidate correction rates on the auto-filled profile review step) |
| 7 | **Match score computed and cached, not live-recalculated per deck request** | Keeps deck-fetch latency low; avoids redundant computation across dozens of cards per session | Recompute on every request | If staleness between profile edits and score updates becomes a visible product problem, tighten the recomputation triggers (Section 7.4) before reconsidering the caching approach itself |
| 8 | **Socket.io (not raw WebSocket / not a managed real-time service like AWS AppSync/IoT Core)** | Battle-tested reconnection/backoff, room abstraction, and a mature Redis adapter for horizontal scaling, without vendor-specific real-time infra lock-in | Raw `ws` library, or a managed real-time service | If operating the Redis pub/sub adapter at very high WebSocket connection counts becomes a genuine ops burden, a managed service becomes worth the trade-off |
| 9 | **SQS over a heavier event broker (Kafka/Kinesis)** | Durable, at-least-once delivery is all the MVP's async needs actually require; fully managed, near-zero ops | Kafka / Amazon MSK | If true event-replay/streaming semantics (multiple independent consumers replaying the same event history) become a real product need, not just "queueing work" |
| 10 | **JWT + refresh token rotation (custom), not a hosted auth provider (Auth0/Cognito)** | Full control over token claims and refresh-rotation/session-revocation semantics, no per-MAU vendor cost | AWS Cognito / Auth0 | If auth-related engineering time becomes a genuine drag relative to a hosted provider's cost at scale, or compliance requirements (SOC2, etc.) make a vendor's pre-built controls valuable |
| 11 | **Direct-to-S3 presigned upload** for resumes | Keeps large file bytes off the application server entirely | Proxy the upload through the NestJS API | Essentially never — this is a standard, low-risk pattern with no real downside at any scale considered here |
| 12 | **`messages`/`swipes` on `BIGSERIAL`, everything else on `UUID`** | Sequential PKs are cheaper to index at very high write volume; UUIDs avoid leaking sequential business volume and merge safely across environments elsewhere | UUID everywhere, for consistency | If cross-environment data merging or ID-guessability on these two tables becomes a real concern, worth reconsidering — deliberately narrow, table-specific trade-off rather than a system-wide one |

---

## Closing Notes

This architecture is intentionally **boring where it should be boring** (Postgres for anything that must be correct, S3 for anything binary, SQS for anything that can wait a few seconds) and **specialized only where the product's actual bottleneck lives** — the swipe-and-match hot path. Every "defer to scale" decision in this document (OpenSearch, service extraction, Redis cluster mode, RDS Multi-AZ) has its schema, service boundary, or event contract already in place, so none of them require a rework of what's built at MVP — only a provisioning and deployment change when the numbers say it's time.
