# SwipeHire — Technical Proposal & Architecture Blueprint
### A Dual-Sided, Swipe-Based Job Marketplace for iOS & Android

*"SwipeHire" is used as a working title throughout this document — swap in whatever name you land on. Two companion diagrams (system architecture and user journey) are provided alongside this file.*

---

## Executive Summary

The core design tension to solve is this: Tinder's mechanics work because a bad swipe costs nothing — two seconds, maybe a wasted glance. In hiring, a bad "match" costs a recruiter's afternoon and a candidate's PTO day for an interview that was never going to go anywhere. Every recommendation in this document is built around preserving the speed and lightness of the swipe interaction while quietly raising the quality bar on what actually gets served into the stack, so the fun, low-friction UX doesn't degrade into noise the way cold-outreach recruiting already has.

The short version of the plan: React Native on the New Architecture (Fabric + TurboModules — no longer optional as of RN 0.76+, and the foundation the whole performance section is built on) for the client; a modular NestJS backend that treats swipes as an event stream rather than direct database writes, which is the single highest-leverage decision for meeting your "heavy write" requirement; PostgreSQL with the `pgvector` extension as the primary store, doing double duty as both the relational system of record and the semantic matching engine; and a security model where a recruiter is cryptographically incapable of pulling a candidate's contact details before a match exists, enforced at the query layer rather than just hidden in the UI.

---

## 1. Concept Analysis — Adapting Dating-App UX for Hiring

### 1.1 What Actually Transfers From Tinder/Bumble

Three mechanics are worth taking wholesale:

- **Binary decisioning kills choice paralysis.** Presenting one candidate or one job at a time — instead of a scrollable list — forces a real decision instead of endless comparison-shopping. This is the single biggest UX upgrade this format offers over a traditional job board or ATS.
- **Progressive disclosure.** The card front shows only what's needed to decide "worth a closer look or not" — the full resume/JD lives one tap away. This keeps the primary loop fast while still letting a genuinely interested party go deep.
- **Double opt-in as a filter, not just a gimmick.** This is arguably the most valuable mechanic to port over. It structurally eliminates the two things everyone hates about hiring platforms: candidates getting cold-pitched for irrelevant roles, and recruiters wading through applicants who aren't actually interested in the role as posted. Nobody enters a chat who didn't choose to be there.

### 1.2 Where the Analogy Breaks — and the Fixes

Hiring isn't dating, and pretending otherwise will hurt the product in a few specific, predictable ways:

- **Swipe fatigue is a much bigger deal here.** On Tinder, an impulsive low-effort right-swipe just means an extra match to ignore. On a hiring platform, it consumes a real person's scheduling time on the other end. Mitigations: cap swipes per day (mirrors Hinge/Bumble's daily limits), and/or require a minimum card-view time before a swipe registers as valid — small friction that filters out the "just seeing if it's a match" reflex.
- **Supply and demand are wildly asymmetric.** A popular listing at a recognizable company might get thousands of candidate-side swipes; a niche candidate profile might get almost no recruiter eyes. Don't serve cards in raw recency order — rank by a match-quality score (§2.4) so the algorithm does the curation a reverse-chronological feed can't.
- **Ghosting after a match is far more costly than a dating-app no-show.** Solve this structurally, not with a "please respond!" nudge — see §1.6.

### 1.3 Card Design — Job Seeker Profile (shown to recruiters)

Where Tinder spends its primary visual real estate on a photo, this card spends it on signal:

- **Front of card:** role/title aspiration, 3–5 skill badges (rendered as recognizable tech-stack icons, not just text — a React or Kubernetes logo reads faster than the word), years of experience, location + remote preference, notice period, and — most important — a **match-quality score** against the specific listing the recruiter is currently browsing (e.g. "87% match"). This single number is the most decision-relevant thing on the card and should be the most visually prominent element after the name.
- **Expanded view (tap/swipe up):** full resume preview, portfolio/GitHub links, education, and 2–3 project highlights pulled out as bullets rather than buried in resume prose.

### 1.4 Card Design — Job Listing (shown to candidates)

- **Front of card:** company name/logo, role title, required tech stack, compensation range (transparency here is table stakes for the audience this app will attract), remote/hybrid/onsite, and — borrowed from Bumble's profile-prompt videos — an optional 15–30 second clip from the hiring manager. A generic job post starts to feel like every other job post after the fifth one; a real human talking for 20 seconds doesn't.
- **Expanded view:** full JD, team size, tech stack breakdown, interview process outline (candidates consistently rank "I don't know what the process looks like" as one of their biggest hiring frustrations — solving it here is a genuine differentiator).

### 1.5 Bias Mitigation as a Product Feature, Not an Afterthought

Dating apps can lean on photo-first judgment; a hiring platform can't without reproducing every well-documented bias in resume screening (name-based, pedigree-based, photo-based). Default new job-seeker cards to a **"blind-first" mode**: name, photo, and college are hidden from the recruiter's card view until a match is close or has occurred; skills, project work, and the match score lead instead. This is good practice on its own merits, and it's a genuinely strong narrative for a security/ethics-conscious portfolio piece — "designed the default data-visibility state to prevent bias" is a much better interview answer than "built a Tinder clone."

### 1.6 Anti-Ghosting: Match Expiry Windows

Give every match a countdown — a window (start around 5–7 days, tune later) during which the chat stays active for scheduling. A "still interested?" nudge fires near the end of the window, mirroring Bumble's 24-hour rule but sized appropriately for something as asynchronous as interview scheduling rather than a first date. If the window lapses with no scheduling activity, the match auto-expires and both parties are freed to move on — this keeps the platform from accumulating a graveyard of dead matches that quietly erode trust in the "match" signal itself.

---

## 2. Architecture & Tech Stack

### 2.1 Pattern: Modular Monolith First, Extract Under Load

Resist the urge to start with five microservices. Build one well-modularized NestJS application (distinct modules for auth, profiles, listings, swipes/matching, chat) so the codebase stays fast to iterate on pre-launch, then extract the genuinely hot paths — swipe ingestion and chat — into standalone services once real load justifies the operational overhead. This is also a better story to tell in an interview than "I used microservices because that's what scalable apps use": it shows judgment about *when* complexity is earned.

### 2.2 API Layer

**NestJS (Node.js + TypeScript)** over plain Express — it's still fully within MERN-adjacent territory so your existing Node experience transfers directly, but its built-in dependency injection and module boundaries make a multi-domain app like this much easier to keep organized than hand-rolled Express routing, and it has first-class WebSocket support for the chat layer. Use REST for standard CRUD (profiles, listings) and lean on NestJS's WebSocket gateways for anything real-time (chat, live match notifications, presence).

### 2.3 The Heavy-Write Problem: Swipe Ingestion Pipeline

This is the crux of the "heavy write operations" requirement, and it's worth solving deliberately rather than just throwing hardware at it. A naive design — write every swipe synchronously to the primary relational database — will bottleneck under real load, and it's unnecessary work: swipes are append-only, latency-tolerant events, except for the *one* thing that genuinely needs to be instant — the mutual-match check.

**Recommended pipeline:**

1. Client swipes → API publishes a swipe event to a queue (SQS or Kinesis) and returns immediately. This decouples ingestion from processing and absorbs write spikes without touching the primary database on the hot path.
2. A lightweight match-check service does an **O(1) lookup in Redis** — a set membership check for "has the other party already swiped right on me?" This is exactly what Redis is built for, and it's what makes the "It's a match!" moment feel instant, which matters enormously for the UX.
3. An async worker consumes the queue, persists the swipe (and match, if one occurred) durably into Postgres, and triggers push notifications / chat-room creation on a match.

```
FUNCTION handleSwipe(swiperId, targetId, direction):
    publish(queue="swipe-events", event={swiperId, targetId, direction, ts=now()})

    IF direction != "right":
        RETURN { matched: false }

    reciprocalKey = "liked_by:" + targetId        # who has already liked the target?
    IF SISMEMBER(reciprocalKey, swiperId):
        RETURN { matched: true }                   # instant, O(1) — mutual right-swipe

    SADD("liked_by:" + swiperId, targetId)          # record this swipe for future checks
    RETURN { matched: false }
```

This keeps user-facing latency low (the response comes from Redis, not from a durable write) while the durable persistence happens asynchronously and can be batched.

### 2.4 Database Structure

**Primary store: PostgreSQL (via RDS or Aurora), with the `pgvector` extension** — chosen over defaulting to MongoDB (your MERN comfort zone) for a specific reason: matches, users, and job listings have real relational integrity requirements (foreign keys between users, swipes, matches, chats, interviews), and `pgvector` lets the same database engine handle the semantic candidate-JD matching without standing up a separate vector database. As of 2026, `pgvector` with HNSW indexing comfortably handles single-digit-millisecond similarity queries at the scale this app will run at for a long time, and it's natively supported on RDS — you don't add infrastructure, you add an extension. MongoDB would absolutely still work here if you'd rather stay in your existing comfort zone given time constraints; the recommendation to move to Postgres is specifically because match/relational integrity plus free vector search is a strong combination, and it's a good opportunity to add a second database paradigm to your resume.

A trimmed core schema:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('job_seeker','recruiter','admin')),
    password_hash   TEXT,
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE job_seeker_profiles (
    user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline             TEXT,
    skills                TEXT[],
    years_experience     NUMERIC,
    resume_url           TEXT,              -- S3 object key, never a public URL
    resume_embedding     VECTOR(768),        -- pgvector
    location             TEXT,
    remote_pref          TEXT,
    salary_expect_min    INT,
    salary_expect_max    INT,
    contact_encrypted    BYTEA,              -- decrypted server-side only post-match
    profile_visibility   TEXT DEFAULT 'blind_first'
);

CREATE TABLE job_listings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),
    recruiter_id    UUID REFERENCES users(id),
    title           TEXT NOT NULL,
    tech_stack      TEXT[],
    comp_min        INT,
    comp_max        INT,
    jd_embedding    VECTOR(768),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE swipes (
    id            BIGSERIAL PRIMARY KEY,
    swiper_id     UUID NOT NULL,
    target_id     UUID NOT NULL,
    target_type   TEXT NOT NULL CHECK (target_type IN ('candidate','job_listing')),
    direction     TEXT NOT NULL CHECK (direction IN ('left','right')),
    created_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (swiper_id, target_id)
);

CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_seeker_id   UUID REFERENCES users(id),
    recruiter_id    UUID REFERENCES users(id),
    job_listing_id  UUID REFERENCES job_listings(id),
    matched_at      TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active','expired','interview_scheduled'))
);

-- HNSW indexes power the semantic match-score ranking in the card feed
CREATE INDEX ON job_seeker_profiles USING hnsw (resume_embedding vector_cosine_ops);
CREATE INDEX ON job_listings USING hnsw (jd_embedding vector_cosine_ops);
```

**Supporting stores:**
- **Redis (ElastiCache)** — the match-check cache above, plus session/presence for chat and swipe-rate-limit counters.
- **S3 + CloudFront** — resumes, profile media, and hiring-manager clips, accessed exclusively via signed URLs. Never a public bucket.
- **The embeddings pipeline** ties directly into your RAG/NLP background: resume text and JD text both get embedded (a sentence-transformer model or a hosted embeddings API works fine here) and the cosine similarity between the two, blended with hard filters (location, comp band, experience level), produces the match score shown on the card front.

### 2.5 Real-Time Chat

**Socket.io with a Redis adapter**, self-built rather than outsourced to a managed chat SaaS (Stream Chat, Sendbird, etc.). Managed chat would ship faster, but building it yourself demonstrates real WebSocket/scaling engineering — worth the extra week or two purely for the portfolio value, and the Redis adapter pattern is what lets Socket.io connections stay in sync across multiple horizontally-scaled server instances, which is itself a concept worth being able to explain in an interview.

### 2.6 Cloud Infrastructure (AWS)

- **Compute:** ECS Fargate for the NestJS services — containerized without the operational burden of managing raw EC2 instances, and it still puts real Docker/orchestration experience on your resume (more so than a pure Lambda approach). EKS (Kubernetes) is worth mentioning as a stretch option if you specifically want Kubernetes experience, at the cost of real added complexity.
- **Database:** RDS for PostgreSQL, or Aurora Serverless v2 if you want the database to scale down (and cost less) during the long stretches a portfolio project sits idle.
- **Cache:** ElastiCache for Redis.
- **Storage/CDN:** S3 + CloudFront.
- **Networking:** Application Load Balancer with WebSocket (WSS) support.
- **Async:** SQS or Kinesis for the swipe event stream (§2.3).
- **Auth:** Amazon Cognito, or a self-rolled JWT + refresh-token flow via NestJS Passport if you'd rather own that logic. Given your Azure AD/MSAL background, Azure AD B2C is a completely valid alternative if you want to showcase that instead — but since the rest of the stack leans AWS, keeping auth AWS-native avoids unnecessary cross-cloud complexity unless showcasing Azure specifically is a goal.
- **IaC:** Terraform (or AWS CDK) to provision all of the above — this is itself a resume differentiator most portfolio projects skip entirely.
- **CI/CD:** GitHub Actions → ECS deploy pipeline.
- **Observability:** CloudWatch plus Sentry for error tracking with source maps.

### 2.7 Stack at a Glance

| Layer | Choice | Why |
|---|---|---|
| Mobile client | React Native, New Architecture, Expo + dev client | Matches your RN experience; New Architecture is the default since RN 0.76 and required for the animation performance this UI needs |
| Gestures/Animation | Reanimated (v4) + Gesture Handler 2 | UI-thread worklets — no per-frame JS bridge cost |
| Global state | Zustand | Minimal boilerplate for a small-team build vs. Redux Toolkit |
| Data fetching/cache | TanStack Query | Background refetch + cursor pagination for the card feed |
| API layer | NestJS (Node.js/TypeScript) | Modular by default, built-in WebSocket support, MERN-adjacent |
| Primary database | PostgreSQL + pgvector (RDS/Aurora) | Relational integrity for matches/users, plus semantic search, in one engine |
| Cache / match-check | Redis (ElastiCache) | O(1) mutual-swipe lookups, presence, rate limiting |
| Object storage | S3 + CloudFront | Resumes and media, signed URLs only |
| Swipe ingestion | SQS / Kinesis | Decouples write spikes from durable persistence |
| Real-time chat | Socket.io + Redis adapter | Self-built for portfolio depth; scales horizontally |
| Auth | Cognito or self-rolled JWT/Passport | MFA enforced for recruiter accounts |
| IaC / CI-CD | Terraform + GitHub Actions → ECS Fargate | Reproducible infra, matches your DevOps background |

---

## 3. Frontend Optimization — React Native Performance

### 3.1 Card Stack Rendering: Recycle, Don't Remount

Never mount the entire deck. Keep only the current card plus the next 1–2 preloaded underneath it in the component tree — as the user swipes, recycle the "consumed" card's position and props for the next incoming card rather than unmounting and mounting fresh components. This is the same principle behind `FlatList`'s windowing, hand-applied since a swipe deck isn't a scrollable list. Wrap card components in `React.memo` and keep prop references stable (`useCallback`/`useMemo`) so a new card arriving at the bottom of the stack doesn't trigger re-renders of cards already on screen.

### 3.2 Gesture & Animation: Get Off the JS Thread

This is the single biggest lever for 60fps. `react-native-gesture-handler`'s declarative `Gesture.Pan()` API (Gesture Handler 2.x) combined with `react-native-reanimated` worklets means the entire drag gesture — tracking, rotation, spring-back or fling-away — runs on the UI thread, never touching the JavaScript bridge per frame. The older `PanResponder`/`Animated` approach drives everything from the JS thread and reliably drops to 20–30fps under load; this doesn't.

```tsx
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

function Card({ onSwiped }: { onSwiped: (dir: 'left' | 'right') => void }) {
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      rotate.value = (e.translationX / SCREEN_WIDTH) * 12;
    })
    .onEnd((e) => {
      const pastThreshold = Math.abs(e.translationX) > SWIPE_THRESHOLD;
      if (pastThreshold) {
        const dir = e.translationX > 0 ? 'right' : 'left';
        translateX.value = withSpring(Math.sign(e.translationX) * SCREEN_WIDTH * 1.5, {}, () =>
          runOnJS(onSwiped)(dir)
        );
      } else {
        translateX.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, style]} />
    </GestureDetector>
  );
}
```

`runOnJS` is the only bridge crossing in this whole interaction, and it fires once, on release — not per frame.

### 3.3 The New Architecture Isn't Optional Anymore

Worth being explicit about, since it changes how you should scaffold the project from day one: React Native's New Architecture (JSI + Fabric + TurboModules) has been the default since RN 0.76, and as of RN 0.82 the old bridge-based architecture has been permanently disabled — there's no "decide later" option in 2026. Expo SDK 52+ ships it by default, so starting the project with a recent Expo dev-client build gets you this for free rather than requiring a manual migration. Practically, this means: synchronous JS↔native calls via JSI instead of async JSON serialization, and Fabric's C++ shadow tree handling layout without a JS round-trip — which is precisely the bottleneck that used to make gesture-heavy UIs like this one hard to keep smooth.

### 3.4 Memory Leak Prevention Checklist

- Clean up every subscription (chat socket listeners, gesture refs) in `useEffect` cleanup functions — this is the most common source of RN memory leaks in apps with persistent WebSocket connections.
- Don't let "swiped cards" accumulate unbounded in state. Push each swipe result to the backend immediately and drop the local reference; keep only the last few for an "undo swipe" feature if you want one.
- Use `expo-image` or `FastImage` instead of the core `Image` component for profile photos, company logos, and clips — the core component has known memory/decode issues with image-heavy lists on Android.
- Use Hermes (default JS engine, and required by the New Architecture) — smaller memory footprint and faster startup than JavaScriptCore.
- Defer non-critical work off the interaction path: don't run JSON parsing or synchronous storage writes on swipe-release — push it through `InteractionManager.runAfterInteractions` or a `requestAnimationFrame` callback instead.

### 3.5 Prefetching & Perceived Performance

Fetch the next batch of cards (cursor-based pagination, ~10 at a time) via TanStack Query well before the user exhausts the current stack, with background refetch so there's never a visible loading spinner mid-swipe. Prefetch and decode the next 2–3 cards' images (`Image.prefetch` or the FastImage/expo-image equivalent) so they're already cached by the time each card becomes visible.

### 3.6 State Management Split

Keep this boundary strict: global state (auth, the match list, notification counts) lives in a lightweight store like Zustand. The *transient* gesture values for the active card — `translateX`, `translateY`, `rotate` — live as Reanimated `useSharedValue`s local to the card component, never in global state. Updating a global store on every animation frame (~60 times a second) would cascade re-renders across the whole tree; this is one of the most common performance mistakes in swipe-card implementations.

### 3.7 Debugging & Profiling in 2026

Worth flagging since this has genuinely changed: Flipper is dead — deprecated as of RN 0.73 and removed from new app templates since 0.74. Use **React Native DevTools** instead (built in since RN 0.76, with a browser-grade Performance Panel added in 0.83) for JS profiling and the component tree; **Reactotron** if you want Redux/Zustand action timelines; and native tooling (Xcode Instruments, Android Studio's Layout Inspector) directly for anything below the JS layer, particularly Fabric-specific layout bugs that look fine in React DevTools but render wrong on-device.

---

## 4. Security & Privacy

### 4.1 Data Classification

Treat these as three distinct sensitivity tiers: **high** — PII, resume content, chat messages; **medium** — match history, swipe behavior; **low** — public-facing job listing content. The access-control and encryption decisions below flow from this classification.

### 4.2 Encryption

- **At rest:** S3 server-side encryption with a customer-managed KMS key (not the AWS-managed default) for resumes and media, so you retain audit control over key usage. RDS encryption at rest, enabled from day one — retrofitting it later means a full data migration.
- **In transit:** TLS 1.2+/1.3 everywhere, including WSS for the chat socket, with HSTS enforced.
- **Field-level encryption for contact PII specifically** — this is what makes the blind-first mode (§1.5) real rather than cosmetic. If contact details are only *hidden in the UI*, they're one API inspection away from being exposed. Encrypt the field itself (envelope encryption via KMS, or a library like `node-forge`) so the API genuinely cannot return it pre-match — the decryption key is only invoked server-side after a match record exists.

### 4.3 Access Control & IDOR Prevention

- **RBAC** via JWT claims and NestJS guards: `job_seeker`, `recruiter`, `admin`.
- **Object-level authorization on every sensitive read** — a recruiter's request for a candidate's resume must verify a match exists between that recruiter and that candidate *at the service layer*, not just via UI routing. This is a textbook IDOR (Insecure Direct Object Reference) prevention pattern, worth naming explicitly given where you're headed career-wise.
- **Multi-tenancy scoping** — if multiple recruiters share an organization account, scope every listing and candidate-pipeline query by `org_id`. Postgres Row-Level Security is worth using here as defense-in-depth on top of application-layer checks, not instead of them.

### 4.4 File Upload Security

Validate MIME type via magic-byte sniffing, not file extension. Enforce size limits. Run malware scanning on every upload (ClamAV via a Lambda trigger on S3 upload, or AWS GuardDuty Malware Protection for S3). Strip embedded macros from any Office-format resume and convert server-side to a normalized PDF/text form before parsing — don't trust the raw uploaded file as an input to anything downstream, since document-format exploits are a real and recurring attack vector.

### 4.5 Authentication Hardening

Argon2 or bcrypt for password hashing if not fully delegating to OAuth. Short-lived access tokens with rotating refresh tokens. Make MFA (TOTP) available to everyone, and strongly recommend or outright enforce it for recruiter accounts specifically — they're the higher-value target, since a compromised recruiter account exposes aggregated candidate PII rather than just one person's data.

### 4.6 Abuse Prevention & Rate Limiting

Per-IP and per-account rate limits on swipe and profile-view endpoints (this is what protects against bulk scraping of the candidate database — a real risk for any platform holding structured resume data at scale). CAPTCHA on signup and after repeated failed logins. Basic anomaly detection on swipe velocity — 500 right-swipes in ten seconds is a bot, not a person — which, given your Random Forest experience, is a very natural candidate for a small classifier down the line rather than just a hard threshold.

### 4.7 Regulatory Compliance — DPDP Act (and Beyond)

Since you're Delhi-based and this will almost certainly launch India-first, India's Digital Personal Data Protection framework is the relevant baseline, and its timeline is worth building around from day one rather than retrofitting later. The DPDP Rules 2025 were notified in November 2025 and are being enforced in three phases: the Data Protection Board of India is already operational (Phase 1, immediate); the Consent Manager framework becomes operative in November 2026 (Phase 2); and the full substantive obligations — notice-and-consent mechanics, data-principal rights (access, correction, erasure), breach notification, rules on processing children's data, and cross-border transfer provisions — become enforceable by May 2027 (Phase 3), with penalties reaching up to INR 250 crore for serious violations.

Practically, given your roadmap lands around the end of 2026, that puts a real launch somewhere in the middle of this phased rollout — which is exactly the argument for building consent capture, data minimization, and a working erasure/correction flow into the MVP rather than treating them as a post-launch compliance sprint. If you expand beyond India later, the same architecture (explicit consent, purpose limitation, a real deletion path) covers most of GDPR's spirit too, even though the specific legal obligations differ.

### 4.8 Chat Security

TLS in transit plus at-rest database encryption is the pragmatic default — true end-to-end encryption (Signal-protocol style) is possible but makes server-side spam/harassment moderation impossible, since the server can no longer read message content to flag abuse. Most professional messaging platforms (LinkedIn included) make the same trade-off for this reason. If you want to flex the cryptography specifically, frame E2EE as an explicit phase-2 stretch goal rather than baking it into the MVP.

---

## 5. Development Roadmap

### 5.1 16-Week Phased Plan

| Phase | Weeks | Focus | Key Deliverables |
|---|---|---|---|
| 0 — Planning & Design | 1–2 | Data model, wireframes, infra skeleton | ER diagram finalized, wireframes for both card types, AWS account/IAM setup, CI/CD skeleton |
| 1 — Backend Foundations | 3–4 | Auth, core CRUD | JWT auth + refresh tokens, role-based guards, user/org/profile CRUD, S3 resume upload with malware scan |
| 2 — Listings & Profiles | 5–6 | Job & candidate data | Job listing CRUD, resume-parsing pipeline (skill/experience extraction), embedding generation for resumes + JDs |
| 3 — Swipe & Matching Engine | 7–9 | The core loop | Ranked card-feed API, swipe endpoint → queue → Redis match-check, match creation + push notification |
| 4 — Real-Time Chat | 10–11 | Post-match | Socket.io server with Redis adapter, chat UI, message persistence, interview-slot proposal flow |
| 5 — Frontend Performance Pass | 12–13 | 60fps | Reanimated card stack per §3, image/prefetch caching, profiling with React Native DevTools, memory leak audit |
| 6 — Security Hardening | 14 | Lock it down | IDOR audit, rate limiting, encryption review, OWASP ZAP baseline scan, dependency audit |
| 7 — Beta & Launch Prep | 15–16 | Ship it | Onboarding polish, funnel analytics, closed beta, app store privacy labels |

### 5.2 Milestone Success Metrics

- **End of Phase 3:** match-detection latency under 500ms p95, measured from swipe-release to the "It's a match" screen.
- **End of Phase 5:** sustained 60fps on a mid-tier Android device with 50+ cards loaded into the feed.
- **End of Phase 6:** zero critical/high findings on an OWASP ZAP baseline scan against the API.
- **Beta:** track swipe-to-match rate *and* match-to-scheduled-interview rate as your two north-star metrics — the second matters far more than the first. A platform optimizing purely for match volume without conversion to real interviews is optimizing for the wrong thing, which is precisely the Tinder failure mode this whole design is trying to avoid.

---

## 6. User Journey Flowchart

The attached `swipehire-user-journey-flowchart.mermaid` file maps the full logic from app launch through both onboarding paths (job seeker and recruiter), the swipe loop on each side, the mutual-match check, chat unlock, the response-window branch, and through to interview confirmation. The attached `swipehire-architecture-diagram.mermaid` file maps the system components described in §2 — client, edge/gateway, application services, and data layer — and how they connect, including the swipe-ingestion queue and async worker path from §2.3.

---

## Appendix A — Recommended Stack at a Glance

*(See §2.7 above for the full table with rationale.)*

## Appendix B — Suggested Next Steps

1. Lock the data model (Appendix schema above is a solid starting point) and run it past one or two people who've actually hired through a broken ATS — the fastest way to catch a UX gap before writing code.
2. Scaffold the NestJS backend with the auth + swipe modules first — that's the part everything else depends on.
3. Build the card-swipe interaction in isolation (a throwaway screen, static data) before wiring it to real APIs — get the 60fps feel right first, since that's the entire value proposition of the format.
