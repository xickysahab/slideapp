# SwipeHire — CLAUDE.md
### Project Constitution for Claude Code — Read This Before Every Session

---

## 0. Operating Principle (read this section every time, not just once)

This project has **seven finished planning documents**. They already contain every decision — product scope, architecture, database schema, security model, visual design, and the engineering ticket breakdown. Your job is to **build exactly what they specify** — not to redesign, simplify, "improve," reorder, or fill gaps with your own judgment.

Two rules override everything else in this file:

1. **Do not change anything the docs already decided.** If a doc says PostgreSQL, don't use MongoDB. If a doc says 15-minute JWT expiry, don't use 1 hour. If a doc specifies a color hex code, use that exact hex code. If you think a decision in the docs is wrong or outdated, say so out loud and ask — never silently substitute your own choice.
2. **Do not skip or quietly drop anything marked MVP / Must-have.** Every "Must-have for MVP" ticket, every non-negotiable security rule, every accessibility rule in the frontend spec is in scope. If something is genuinely ambiguous or two docs conflict, stop and ask (§17) — don't pick the easier option and move on.

**Before writing any code for a feature, re-open and re-read the relevant section of the source doc(s) listed in the Quick File Map (§19).** Don't rely on your memory of these documents from earlier in the conversation — they are long and dense, and paraphrasing from memory is exactly how details get quietly dropped. Copy schema field names, types, hex codes, endpoint paths, and constants **verbatim** from the source file, not from recollection.

---

## 1. Source-of-Truth Documents

All seven files live in `/docs` at the repo root. Do not edit them — they are the spec, not scratch space.

| File | Role | What it governs |
|---|---|---|
| `swipehire-prd.md` | **Product authority** | What we're building, for whom, what's IN/OUT of V1, success metrics, product principles |
| `SwipeHire_Technical_Architecture.md` | **Architecture authority** | Tech stack, system design, full DB schema, swipe/match pipeline, resume pipeline, match scoring, search, chat, interview scheduling, AWS topology, folder structure, Architecture Decision Log |
| `SwipeHire_Frontend_Specification.md` | **Design/UX authority** | Visual design system, color/type tokens, component inventory, card layouts, screens, navigation, API integration contract as seen from the client, accessibility rules |
| `SwipeHire_Security_Access_Document.md` | **Security authority** | Auth, RBAC/ownership, RLS policies, file security, privacy visibility rules, swipe/match/chat security, verification, error handling, DPDP compliance, pre-production checklist |
| `SwipeHire_Engineering_Ticket_List.md` | **Work-breakdown authority** | Every epic, every ticket, acceptance criteria, dependencies, MVP phase sequence — this is your actual sprint board |
| `swipehire-technical-proposal.md` | Background / rationale only | Earlier draft of the architecture — read for the "why," but superseded wherever it conflicts with `SwipeHire_Technical_Architecture.md` |
| `swipehire_technical_analysis.md` | Background / rationale only | Earliest draft — same status: superseded wherever it conflicts with the later docs |

### Authority order when documents disagree

1. **`SwipeHire_Technical_Architecture.md`** wins on all backend/system architecture questions — it's the newest, most detailed, and the only doc with an explicit Architecture Decision Log (its §15).
2. **`swipehire-prd.md`** wins on all "is this in scope for V1" questions.
3. **`SwipeHire_Frontend_Specification.md`** wins on all exact visual/UX questions.
4. **`SwipeHire_Security_Access_Document.md`** wins on all exact security/privacy/compliance implementation detail.
5. **`SwipeHire_Engineering_Ticket_List.md`** wins on sequencing/dependencies/"what counts as done" for a given ticket.
6. The two "background" docs never win a conflict — they're context, not spec.

---

## 2. Known Conflicts Between Documents — Already Resolved

These docs were written at different times and genuinely disagree in a few places. Don't rediscover these mid-build and improvise — here's the resolution, per the authority order in §1. If you disagree with a resolution below, flag it to Aagam before building the affected piece — don't silently override it either way.

| Topic | Where the conflict is | Resolution |
|---|---|---|
| **Chat message storage** | `swipehire_technical_analysis.md` and the `INFRA-01` ticket mention DynamoDB for chat. `SwipeHire_Technical_Architecture.md` (§1, §4, ADR #12) and the Security doc both specify Postgres. | **Postgres.** `messages` is a `BIGSERIAL`-keyed Postgres table, partitioned by month at scale (Architecture §4.1, §14). Do **not** provision a DynamoDB table. Treat the DynamoDB mention in `INFRA-01`'s description as stale — provision RDS Postgres instead when working that ticket. |
| **Search / candidate-skill matching** | `swipehire_technical_analysis.md` proposes Elasticsearch as a core MVP component. `SwipeHire_Technical_Architecture.md` (§8.1, ADR #5) treats OpenSearch as designed-in but **deferred past MVP day-one**, with pgvector + Postgres full-text search (`tsvector`) covering launch needs. | **pgvector (HNSW) is the MVP semantic-matching engine; OpenSearch is not provisioned at MVP launch.** Build the schema/indexing hooks so OpenSearch is a clean add-on later (Architecture §8.3), but don't stand up the OpenSearch cluster or wire a dedicated search index unless explicitly asked to bring that forward. |
| **Auth provider** | `swipehire-technical-proposal.md` / `swipehire_technical_analysis.md` list Cognito/Auth0 as live options. `SwipeHire_Technical_Architecture.md` ADR #10 commits to a **custom** JWT + Passport.js implementation. | Custom JWT (RS256 access token + opaque rotating refresh token via NestJS Passport strategies). No Cognito, no Auth0, no Azure AD B2C, unless Aagam explicitly changes this. |
| **Password hashing** | Technical proposal says "Argon2 or bcrypt." Security doc is specific: Argon2id. | **Argon2id**, per the Security doc — it's the more detailed and more recent source on this exact point. |
| **Fast-Track / Super Swipe** | PRD (§4 row 15, §9) explicitly marks this **Future**, not V1. Frontend spec fully designs its gesture, stamp color, and button. Ticket list (`SWIPE-08`) marks it "Nice-to-have," explicitly listed under "can safely wait past MVP." | **Not implemented in MVP.** The design tokens/colors for it may exist in the theme file (harmless to have), but the swipe-up gesture, quota system, and priority-queue logic are out of scope until Aagam asks for it. Default MVP swipe deck supports left (pass) and right (shortlist) only. |
| **Interview calendar sync** | PRD (§9) explicitly excludes calendar integration from V1 ("in-chat slot proposal only"). `SwipeHire_Technical_Architecture.md` §10.3 fully designs Google Calendar/Microsoft Graph OAuth sync. Ticket list (`INTERVIEW-04`) marks it explicitly deferrable. | **MVP ships in-chat slot propose → accept → confirm only** (`INTERVIEW-01/02/03`). Build the `interviews` table with room for `calendar_event_id` etc. (per Architecture §10) so the OAuth sync is a clean addition later, but don't implement the OAuth flow itself until asked. |
| **Primary datastore for candidate profiles** | `swipehire_technical_analysis.md` floats MongoDB as an option "if you want to lean on MERN skills." Every later doc (Architecture, Security) is Postgres-only. | **PostgreSQL only.** No MongoDB anywhere in this stack. |
| **Reanimated version** | Some docs say Reanimated v3, the Architecture doc explicitly calls out v4 + Gesture Handler 2 as required given the New Architecture is mandatory as of RN 0.82. | Use whatever the **latest stable Reanimated release compatible with React Native's New Architecture** is at implementation time — check current npm versions rather than hardcoding a number from any one doc, since this is the one place version drift across docs is expected. Architecture §3.3's reasoning (New Architecture is non-optional) is what to follow, not a specific pinned version number. |
| **Redis key-naming for the swipe hot path** | `swipehire-technical-proposal.md` §2.3 uses a simplified `liked_by:{id}` pseudocode. `SwipeHire_Technical_Architecture.md` §5.1–§5.4 gives the actual key schema (`swipe:job:{J}:right`, `deck:candidate:{C}:seen`, match lock keys, etc.). | Implement exactly the key structure in **Architecture §5** — the technical-proposal's version is the simplified concept explanation, not the implementation spec. |

---

## 3. Product Summary (from the PRD — do not re-derive this yourself)

SwipeHire is a **trust-first, mutual-intent hiring marketplace**: candidates swipe on jobs, recruiters swipe on candidates (per job listing), and a match — created only on a mutual right-swipe for that *specific* job — unlocks full profile visibility, in-app chat, and in-chat interview slot proposal. It is explicitly **not** a dating-app clone: the swipe is a lightweight interest signal gating something that still requires real information (resume, JD, transparent match score).

The single most important product principle (PRD §10): **relevant matching over volume.** Every engineering decision that trades quality for scale/speed should be checked against this before being accepted.

Left swipes are silent and permanent (never shown again, other party never notified) — this is deliberate and load-bearing for the whole trust model (PRD §5), not a missing feature.

---

## 4. MVP Scope Wall

Treat this as a hard boundary. Everything in the left column ships in V1. Nothing in the right column does, even if it would be easy to add while you're already in that part of the code.

**In scope (PRD §4, all rows marked MVP):** candidate & recruiter onboarding, candidate profile + resume upload + basic rule-based resume parsing with human review/correction, recruiter/company profile, job creation, candidate-side job discovery feed, recruiter-side candidate discovery feed (scoped to one listing at a time), swipe deck UI, pre-swipe filters (location, comp, remote pref, experience, tech stack), heuristic (not ML) match percentage, swipe left/right, mutual matching, match push notifications, chat after match, in-chat interview slot proposal (no calendar sync), match/application status tracking, recruiter verification (work-email-domain + manual admin review), candidate/job reporting, basic admin moderation dashboard, blind-first privacy defaults.

**Explicitly NOT in V1 (PRD §9) — do not build these unless Aagam asks:**
- Payments/monetization of any kind
- Fast-Track / Super Swipe (see §2 above)
- In-app video interviewing (external links via chat only)
- Calendar sync / automated invite generation (see §2 above)
- AI-generated cover letters or one-click mass-apply — this one is a **product-principle violation**, not just a missing feature; never build an "apply to all" pattern here even if asked casually mid-conversation, flag it back to Aagam instead
- Employer review/rating system
- Multi-language support beyond English
- Web client for either role (mobile-only, iOS + Android)
- ML/embeddings-based semantic matching as the primary scoring mechanism (pgvector cosine similarity is used as one weighted factor per Architecture §7.1 — that's already in scope; a full learned ranking model is not)
- Automated recruiter/business verification (KYB) — manual admin review only
- Public candidate profiles / social feed
- Collaborative/panel hiring workflows (one recruiter per listing)

If a request mid-build sounds like it's reintroducing one of these ("let's just add a quick apply-to-all button"), say so explicitly and confirm before building it — don't build it quietly because it seemed small.

---

## 5. Canonical Tech Stack

Pulled from `SwipeHire_Technical_Architecture.md` §1 (the authoritative table) — always verify exact current library versions yourself rather than trusting a version number typed into any doc, since these age.

| Layer | Technology |
|---|---|
| Mobile frontend | React Native, New Architecture (Fabric + TurboModules), TypeScript, Reanimated (latest New-Architecture-compatible), Gesture Handler 2, Expo dev client |
| Global state | Zustand |
| Data fetching | TanStack Query, cursor-based pagination |
| Backend framework | NestJS (Node.js + TypeScript), **modular monolith** — not microservices at MVP |
| AI/NLP service | Python 3.12 + FastAPI, separate deployable, stateless, never touches Postgres directly |
| Primary database | PostgreSQL 16 (RDS), `pgvector` extension enabled from day one, `pgcrypto` for UUIDs |
| Cache / hot path | Redis (ElastiCache) — swipe buffering, match-check, sessions, presence, rate limiting |
| Search | Postgres `tsvector` at MVP; OpenSearch designed-in, deferred (§2 above) |
| Object storage | S3, private buckets, presigned URLs only, SSE-KMS with a customer-managed key |
| Real-time | Socket.io + `socket.io-redis-adapter`, self-built (not a managed chat SaaS) |
| Queue | SQS (standard + DLQ per queue) in prod; BullMQ (Redis-backed) mirrors the same job contracts in local dev |
| Auth | Custom JWT (RS256 access, 15 min) + opaque rotating refresh token (30 days), NestJS Passport strategies. Google + Apple OAuth as social login. Argon2id for password hashing. |
| Push notifications | SNS → APNs (iOS) / FCM (Android) |
| Email | SES |
| Cloud | AWS: ECS Fargate, RDS, ElastiCache, S3, SQS, SNS, SES, CloudFront, Route 53/ACM, `ap-south-1` (Mumbai) preferred as primary region for Indian user data (Security §12) |
| IaC | Terraform (or CDK) — never hand-provision AWS resources |
| CI/CD | GitHub Actions → ECS deploy; PR triggers lint+test; merge-to-main auto-deploys staging; prod requires manual approval |
| Observability | CloudWatch + X-Ray (swipe→match latency is the metric to instrument first) + Sentry (FE+BE errors) + OpenTelemetry |

**Pattern:** modular monolith first, extract to real microservices only when a module's load/deploy cadence genuinely diverges (chat is the most likely first candidate — Architecture ADR #1). Don't pre-split into microservices "to be safe."

---

## 6. Database Rules

Full schema lives in `SwipeHire_Technical_Architecture.md` §4 — **always copy DDL from that file directly when writing migrations, never retype it from memory.** The rules below are the conventions that are easy to get wrong or drift from:

- **ID types:** `UUID` (via `gen_random_uuid()`) for every table **except** `swipes` and `messages`, which use `BIGSERIAL` — this is a deliberate, narrow exception (Architecture §4.1, ADR #12) for insert-performance reasons on the two highest-write-frequency tables. Don't "clean this up" to be UUID-everywhere.
- **`swipes.target_type` / `target_id` is intentionally polymorphic** (no DB-enforced FK on that column) — integrity is enforced at the application layer instead (ADR #3). This is a conscious trade-off for write-path speed, not an oversight to fix.
- **There is no separate `conversations` table.** `messages.match_id` references `matches.id` directly — a match *is* the conversation thread (Architecture §4.1). Don't add a conversations table.
- **Soft state over soft delete:** most domain tables use a `status` enum, not a `deleted_at` column, because "deleted" is usually a real business state (filled, archived, suspended, unmatched) with its own transitions.
- **Row-Level Security (RLS) is mandatory** on every table containing user/profile/job/swipe/match/message data (Security §4) — this is a second, independent enforcement layer on top of application-level ownership checks, not a replacement for them. Every service-layer method still needs its own ownership check (Security §3) even where RLS also applies.
- **Module ownership of tables is fixed** (Architecture §3.1 table) — e.g., `SwipeMatchModule` owns `swipes`/`matches`; `ChatModule` owns `messages`. Other modules call a service interface (`SwipeService.recordSwipe()`), never query another module's tables directly, even though it's all one deployable at MVP. This boundary is what makes future service extraction mechanical instead of a rewrite — don't erode it for convenience.

---

## 7. Swipe → Match Pipeline (the highest-risk logic to get subtly wrong)

Full flow: Architecture §5. Do not simplify this into a synchronous "swipe → write to Postgres → check for match" implementation — that defeats the entire point of the design and won't meet the latency requirements in the tickets.

1. Every swipe write goes to **Redis first** (`SADD`), never synchronously to Postgres.
2. The mutual-match check is a Redis `SISMEMBER` — O(1), sub-10ms.
3. If mutual interest is confirmed: acquire a short-lived Redis lock (`SET ... NX EX 10`) to prevent double-creation, then **synchronously** insert into `matches` inside a transaction guarded by a unique constraint on `(candidate_id, job_id)` — this is the **one** point in the whole pipeline that's allowed to touch Postgres synchronously, because a match is too significant an event to risk to a batch-flush delay.
4. Everything downstream of a match (push notification, chat room creation) happens **async** via SQS — never inline in the request that created the match.
5. A background worker (BullMQ locally, the same contract via SQS in prod) batch-flushes buffered swipes from Redis into the durable `swipes` Postgres table on a short interval — idempotent via `INSERT ... ON CONFLICT DO NOTHING`.
6. Left swipes never touch the mutual-match check at all — they're a pure "don't show again" signal, buffered and flushed the same way, but never synchronous and never emit an event.

**No API endpoint ever accepts a match object directly from the client** (Security §8). A match is always a derived, server-computed result of two independent, authenticated swipe events. If you ever find yourself writing an endpoint that lets a client assert "we matched," stop — that's a security-model violation, not a shortcut.

---

## 8. Security & Privacy — Non-Negotiable Checklist

This is the condensed version of `SwipeHire_Security_Access_Document.md` §14. Every item here must be true before a feature touching that area is considered done — "we'll harden it later" is not an acceptable answer for anything on this list, per the PRD's own "trust and safety first" principle (§10) and this doc's zero-omission mandate. Consult the full Security doc for the *how* on any row.

**Auth:** Argon2id + breach-list check at signup · Google/Apple OAuth with `email_verified` checked · JWT RS256 15-min access + rotating 30-day opaque refresh · refresh-token reuse = revoke the whole token family · logout revokes refresh token, "log out everywhere" bumps `token_version` · OTP 5-min TTL for reset/verification only, never sole login factor · lockout after repeated failures is temporary + CAPTCHA, never permanent.

**Authorization:** every resource-ID endpoint does a server-side ownership/relationship check, not just a role check · centralize this logic (e.g., CASL), don't copy-paste ad hoc checks per controller · return `404` (not `403`) for "exists but not yours" · non-sequential (UUID/ULID) resource IDs everywhere except the two `BIGSERIAL` exceptions in §6.

**Data:** RLS enabled and tested on every sensitive table · app's DB role is least-privilege with `BYPASSRLS` denied · separate scoped roles for background workers and analytics · unique constraints for swipe/match dedup enforced at the DB layer, not just app logic.

**Files:** S3 buckets private, Block Public Access on, SSE-KMS customer-managed key · presigned URLs short-TTL for both upload and download · malware scanning wired into the upload pipeline **before** a file is usable or parsed · file type validated by content-sniffing (magic bytes), never extension/MIME header alone · deletion actually removes the S3 object, not just the DB row.

**Network:** TLS everywhere including internal service-to-service calls · WAF rules for scraping/abuse patterns · DB/Redis in private subnets, never publicly reachable.

**Secrets:** nothing in source control, ever (CI secret-scanning on) · AWS Secrets Manager / Parameter Store only · separate credentials per environment, dev/staging/prod never share secrets · no static AWS access keys anywhere — ECS Task Roles only.

**Privacy (blind-first, Security §6):** pre-match, a recruiter sees first name + last initial, headline, years experience, city, skill chips, match score, one highlight line — **no** phone, email, full resume, or last name. Full profile/resume unlocks only post-match. Contact info is never auto-revealed even post-match — only via an explicit, logged, revocable share action.

**Chat:** no cold-messaging path exists anywhere — chat is only reachable through an active match, enforced at socket-connect time, on every REST history read, and re-validated on every single `send` event (not just at connection time).

**Rate limiting:** swipes and auth endpoints have Redis-backed, per-user (and per-IP) limits · recruiters additionally get a per-job-listing daily right-swipe cap · idempotency keys on swipe writes to survive client retries without duplicating.

**Verification:** unverified recruiters can browse/set up a profile but cannot post live listings or appear in candidate decks until at least the work-email-domain check passes.

**Compliance (India DPDP Act):** explicit, itemized consent at signup (not one bundled checkbox) · a real deletion pipeline that hard-purges S3 + DB rows + caches, not a soft flag · resume-only deletion available independent of full account deletion · `ap-south-1` preferred as primary region.

---

## 9. Design System Rules (Frontend)

Full spec: `SwipeHire_Frontend_Specification.md`, especially §2 (color), §3 (type), §15 (design tokens object — copy this file's `tokens.ts` block verbatim into `theme/tokens.ts`, don't retype it and risk a transcription error on a hex code).

Non-negotiables:
- **No hard-coded hex/px values inside any component** — everything references `theme/tokens.ts` (Frontend Spec §4).
- **Visual direction is explicitly anti-"dating app."** No heart icons, no flame/streak icons, no hot pink/red as a primary color, no confetti, no bouncy spring-overshoot animation, no photo-first candidate browsing (Frontend Spec §0). If an implementation detail would introduce any of these, it's a spec violation even if it "looks nice."
- **The Match Seal** (circular calibration-dial match indicator, §4.3) is the one recurring signature UI element — build it once as a shared component, reuse everywhere a match score appears, never reimplement it per screen.
- **Recruiter-facing candidate cards are not photo-first by default** — initials avatar, first name + last initial only, pre-match (§6). This is a deliberate anti-bias default from the product spec, not a placeholder to "finish later" with real photos.
- **Three type roles, never mixed outside their role:** Fraunces (display/headline), Inter (UI/body), IBM Plex Mono (every number that represents a fact — salary, match %, experience, timestamps). Don't set a number in Inter because it's convenient in a given layout.
- **Accessibility rules in §12 of the frontend spec are launch requirements, not a follow-up pass** — in particular: 44×44pt minimum touch targets, full `accessibilityLabel`/`accessibilityActions` on every `SwipeCard` (gesture-only interactions are not acceptable as the sole path — a screen-reader-driven list-with-buttons fallback is required), and WCAG AA contrast (note gold `#D6A24C` is never used for text, only fills/borders, since it fails AA at body size).

---

## 10. Repo Structure

Use these exactly — don't reorganize for personal preference. Full trees: Architecture §13 (backend + NLP service), Frontend Spec §14 (mobile app).

- **Mobile app** (`swipehire-mobile/` or `src/` depending on which tree you're following — Frontend Spec §14 is the more detailed, current one for the actual screen/component/hook breakdown; Architecture §13.1 gives the top-level app-vs-native-project layout. Use Frontend Spec §14's `screens/`, `components/`, `hooks/`, `services/`, `store/`, `theme/` breakdown as the working structure.)
- **NestJS backend** (`swipehire-api/`): `src/common/` (guards, filters, interceptors, decorators, pipes), `src/config/`, `src/modules/{auth,profile,company,job,swipe-match,chat,interview,notification,report,search}/`, `src/database/{entities,migrations,seeds}/`, `src/queue/`, `src/shared/` — exact tree in Architecture §13.2.
- **Python NLP service** (`swipehire-nlp-service/`): `app/main.py`, `app/api/v1/resume.py`, `app/services/{extraction,llm_fallback,embeddings}/`, `app/models/`, `app/data/skills_taxonomy.json` — exact tree in Architecture §13.3.

Module boundaries (which module owns which tables, Architecture §3.1) are load-bearing for the future service-extraction path — don't let one module reach into another's tables directly even when it would save a line of code.

---

## 11. Engineering Workflow

`SwipeHire_Engineering_Ticket_List.md` is the actual sprint board — 13 epics (0 through 12): Platform & Infra Foundations, Auth & Onboarding, Candidate Profile, Recruiter & Company, Job Management, Discovery & Filters, Swipe Engine, Matching, Chat, Interview Scheduling, Security & Privacy, Notifications, Admin.

- Work the **"Recommended MVP Implementation Sequence"** at the end of that doc (Phases 0–8) — it's dependency-ordered, not just epic-ordered, and several epics deliberately interleave. Don't reorder it for convenience without flagging why.
- **A ticket is not done until its literal Acceptance Criteria are satisfied** — treat each bullet under a ticket's "Acceptance Criteria" as a checklist, not a vibe. If you can't satisfy one, say so explicitly rather than marking it done anyway.
- The doc's own **"Cannot slip"** list (end of file) is the true MVP core — everything else in "Can safely wait past MVP" (Fast-Track, calendar sync, notification preference center, field-level envelope encryption as an initial interim state, read receipts, suspicious-activity dashboard) is legitimately deferrable, but only those specific items — don't extend that deferral list on your own judgment.
- When a ticket references architecture/security/design detail, pull the exact detail from the relevant source doc (§19 has the map) rather than improvising a reasonable-sounding implementation.

---

## 12. Environment & Secrets

Per Architecture §12 — three environments (development/staging/production), full required-env-var list is in that section. Rules that matter most:

- **Nothing hardcoded, ever:** DB credentials, JWT secrets, OAuth client secrets, LLM API keys — all from AWS Secrets Manager (or SSM for non-secret config), injected at runtime, never baked into images or committed.
- **No static AWS credentials anywhere** — ECS Task Roles only.
- Local dev: docker-compose for Postgres/Redis, SQS mocked via BullMQ or LocalStack, NLP service runs deterministic-only (no live LLM calls by default, so local dev stays free/offline-friendly).

---

## 13. Hard "Do Not" List

- Do not swap a chosen library/framework/datastore for an alternative you personally think is better (Express instead of NestJS, MongoDB instead of Postgres, a managed chat SaaS instead of self-built Socket.io, etc.) without flagging it first — even if your alternative is reasonable, it wasn't the decision that was made.
- Do not start splitting the modular monolith into microservices early "for scalability" — Architecture ADR #1 is explicit that this is deferred until team size or genuine load divergence justifies it.
- Do not stand up OpenSearch, DynamoDB, Cognito/Auth0, or MongoDB at MVP — see §2's resolved conflicts.
- Do not add a feature from the "explicitly NOT in V1" list (§4) because it seemed like a natural extension of something you were already building.
- Do not invent new database fields, tables, or API endpoints not in the Architecture doc's schema/API sections without flagging that you're doing so and why.
- Do not alter design tokens (colors, type scale, spacing, radius) — copy them from Frontend Spec §15 verbatim.
- Do not weaken any item in the §8 security checklist to "ship faster" — if a security requirement is genuinely blocking progress, say so and ask, don't quietly relax it.
- Do not silently resolve a conflict between two docs that isn't already listed in §2 — flag it and propose a resolution, don't just pick one.
- Do not mark a ticket's acceptance criteria as met when it isn't fully met.

---

## 14. Ask, Don't Assume

Stop and ask Aagam directly (don't guess and proceed) when:
- Two source docs genuinely conflict on something not already resolved in §2.
- A ticket's acceptance criteria references something not detailed anywhere in the docs (e.g., an exact numeric threshold the docs left as "tune later").
- You're about to introduce a new third-party dependency/service not named anywhere in the stack table (§5).
- A request in conversation would reintroduce something explicitly marked out-of-scope (§4).
- You're not sure whether a given implementation detail is "designed-in but deferred" (build the schema hook, skip the feature) versus "not part of the design at all."

A quick clarifying question here is cheap. A silently wrong architectural assumption baked into a week of tickets is not.

---

## 15. Quick File Map — Which Doc to Open For What

| You're working on... | Open this file, this section |
|---|---|
| Is this feature in scope for V1 at all? | `swipehire-prd.md` §4, §9 |
| Product principles / why a UX decision exists | `swipehire-prd.md` §10 |
| Exact DB schema / DDL | `SwipeHire_Technical_Architecture.md` §4 |
| Swipe/match Redis+Postgres pipeline | `SwipeHire_Technical_Architecture.md` §5 |
| Resume parsing pipeline | `SwipeHire_Technical_Architecture.md` §6 |
| Match scoring formula/weights | `SwipeHire_Technical_Architecture.md` §7 |
| Search/OpenSearch design | `SwipeHire_Technical_Architecture.md` §8 |
| Chat/WebSocket architecture | `SwipeHire_Technical_Architecture.md` §9 |
| Interview scheduling flow/state machine | `SwipeHire_Technical_Architecture.md` §10 |
| AWS resource sizing (MVP vs. scale) | `SwipeHire_Technical_Architecture.md` §11 |
| Env vars / secrets rules | `SwipeHire_Technical_Architecture.md` §12 |
| Backend/mobile folder structure | `SwipeHire_Technical_Architecture.md` §13, `SwipeHire_Frontend_Specification.md` §14 |
| Any architecture decision's rationale + "when to reconsider" | `SwipeHire_Technical_Architecture.md` §15 (ADR log) |
| Colors, type, spacing, tokens | `SwipeHire_Frontend_Specification.md` §2, §3, §15 |
| Exact card layouts (job card / candidate card) | `SwipeHire_Frontend_Specification.md` §5, §6 |
| Swipe gesture thresholds/motion spec | `SwipeHire_Frontend_Specification.md` §7 |
| Screen-by-screen spec | `SwipeHire_Frontend_Specification.md` §9 |
| Navigation structure | `SwipeHire_Frontend_Specification.md` §10 |
| Client-side API contract per feature | `SwipeHire_Frontend_Specification.md` §11 |
| Accessibility requirements | `SwipeHire_Frontend_Specification.md` §12 |
| Empty/error/loading state copy & treatment | `SwipeHire_Frontend_Specification.md` §13 |
| Auth token/session design | `SwipeHire_Security_Access_Document.md` §1 |
| Who can access what (CRUD matrix) | `SwipeHire_Security_Access_Document.md` §2, §3 |
| RLS policies | `SwipeHire_Security_Access_Document.md` §4 |
| Resume/file upload security | `SwipeHire_Security_Access_Document.md` §5 |
| Pre/post-match visibility rules | `SwipeHire_Security_Access_Document.md` §6 |
| Swipe/match/chat security specifics | `SwipeHire_Security_Access_Document.md` §7, §8, §9 |
| Recruiter verification tiers | `SwipeHire_Security_Access_Document.md` §10 |
| Error envelope / safe error messages | `SwipeHire_Security_Access_Document.md` §11 |
| DPDP compliance / data retention & deletion | `SwipeHire_Security_Access_Document.md` §12 |
| Abuse/moderation detection & response | `SwipeHire_Security_Access_Document.md` §13 |
| Pre-launch security checklist | `SwipeHire_Security_Access_Document.md` §14 |
| What ticket to build next, dependencies, "is this ticket done" | `SwipeHire_Engineering_Ticket_List.md` (find by ticket ID, e.g. `SWIPE-03`) |
| Overall build order | `SwipeHire_Engineering_Ticket_List.md`, "Recommended MVP Implementation Sequence" |

---

*This file is the constitution, not the spec itself — the seven documents in `/docs` are the spec. When in doubt, this file tells you where to look and what to do when the docs disagree with each other; it never overrides what a doc actually says.*
