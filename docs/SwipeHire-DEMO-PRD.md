# SwipeHire — DEMO PRD
### Scope: Client Showcase Build — NOT the Production MVP

---

## 0. What This Document Is

The original `swipehire-prd.md` (and its companion architecture/frontend/security docs) describe a real, 16-week, production-grade two-sided marketplace — full AWS infra, compliance, admin moderation, scale-readiness.

**This document describes a different, smaller thing: a working prototype whose only job is to convince a client/interviewer that the product idea, the design, and the core mechanic are real and well-built.** Every cut made below is made for that single reason — speed to a believable demo — not because the original spec was wrong. Nothing here should be read back into the full spec; when it's time to build the real thing, go back to the original 5 documents.

**If a decision here conflicts with the original PRD, this document wins for the demo build. The original docs win again the moment the goal changes from "show a client" to "launch for real users."**

---

## 1. What the Demo Must Prove

A person holding the phone should be able to, in under 5 minutes, without any staged narration:

1. Sign up as a candidate, upload a resume, and land in a swipe deck of real-looking jobs.
2. Swipe right on a job and see a genuine "It's a Match!" moment (not a canned animation — a real mutual match, because the demo account swipes right on them from the other side, seeded in advance or done live in a second phone/simulator).
3. Open chat with the match and exchange a real message in real time.
4. Propose/accept an interview slot inside that chat.
5. See the same loop from the recruiter's side — swipe on a candidate deck scoped to one job listing, get the match, chat back.

That's the entire proof surface. Everything else in the original PRD is in service of scaling or protecting that loop once it's real — not needed to demonstrate that the loop itself works and looks premium.

---

## 2. Demo Scope Table

| # | Feature | In demo? | Notes |
|---|---|---|---|
| 1 | Candidate onboarding | **Yes** | Email+password or Google sign-in only — skip phone OTP (needs an SMS provider account) |
| 2 | Recruiter onboarding | **Yes** | Same auth methods |
| 3 | Candidate profile | **Yes** | Trimmed fields — see Demo Architecture doc |
| 4 | Recruiter/company profile | **Yes** | No verification workflow — every recruiter is auto-marked "verified" for demo purposes, badge still shows |
| 5 | Resume upload | **Yes** | PDF only, straight to storage |
| 6 | Resume parsing | **Yes, simplified** | Deterministic keyword/skills-taxonomy match only — no LLM fallback, no separate Python service (see Architecture doc §4) |
| 7 | Job creation | **Yes** | Simple form, no multi-step guardrails |
| 8 | Candidate-side discovery feed | **Yes** | Core loop |
| 9 | Recruiter-side discovery feed | **Yes** | Core loop |
| 10 | Swipe deck UI | **Yes** | This is the centerpiece — full gesture/animation polish per Frontend Spec |
| 11 | Pre-swipe filters | **No** | Skip entirely — deck shows everything unfiltered for demo |
| 12 | Match percentage | **Yes, simplified** | 2–3 factors instead of 7 (skills overlap + optional semantic similarity + experience fit) |
| 13 | Swipe left/right | **Yes** | |
| 14 | Mutual matching | **Yes** | Real, synchronous — no Redis/queue pipeline needed at demo scale |
| 15 | Fast-Track / Super Swipe | **No** | Out of scope in the original PRD too |
| 16 | Match notifications | **In-app only** | Toast/badge when app is foregrounded — skip real push (APNs/FCM certs are not worth setting up for a demo) |
| 17 | Chat after matching | **Yes** | Real Socket.io, single instance, no Redis adapter needed |
| 18 | Interview scheduling | **Yes, simplified** | Propose → accept only, one round, no reject/re-propose history, no calendar sync |
| 19 | Match/application status tracking | **Yes, minimal** | A simple matches list screen |
| 20 | Recruiter verification | **No** | Auto-verified, see #4 |
| 21 | Candidate/job reporting | **No** | Not needed to demonstrate the core loop |
| 22 | Admin moderation dashboard | **No** | Cut entirely for demo |
| 23 | Privacy controls (blind-first) | **Yes, but simplified** | Keep the visual behavior (name/photo hidden pre-match) since it's a genuine design differentiator worth showing — skip the full RLS/DB-level enforcement, do it in application logic only |

**Cut entirely, no demo equivalent:** admin dashboard, abuse/moderation pipeline, notification preference center, calendar sync, multi-recruiter company accounts, search/filter UI, DPDP consent-flow UI, session management screen, biometric login.

---

## 3. Demo User Journey (trimmed from the original §6)

**Candidate:** open app → role select → sign up (email/Google) → basic profile form → resume upload → (few-second) parsing → swipe deck → right-swipe → match screen → chat → propose/accept interview slot → matches list shows "Interview scheduled."

**Recruiter:** open app → role select → sign up → company profile (name, logo, one-liner) → create one job listing → candidate swipe deck for that listing → right-swipe → match screen → chat → confirm interview slot.

No branch handling for edge cases (failed parse, expired session, rejected verification, etc.) needs to be pixel-perfect for the demo — a reasonable fallback state is enough; it doesn't need the full Frontend Spec §13 error-state treatment everywhere, though keeping it where cheap is a nice polish signal.

---

## 4. Seed Data Requirement (new — not in the original PRD, because production doesn't need staged data)

**This is the single most important addition for a convincing demo.** An empty swipe deck kills the demo instantly. Before showing this to a client:

- Seed 15–20 realistic job listings across a few recognizable-sounding companies/roles (use plausible Indian tech-market titles/comp bands — the design already assumes ₹ salary bands).
- Seed 15–20 realistic candidate profiles with varied skill sets, so match scores visibly differ card-to-card (don't make every card 90%+ match — a demo where every card matches perfectly looks fake).
- Pre-seed at least one guaranteed mutual match (a specific candidate account + specific job, both already swiped right from the other side) so the "It's a Match!" moment is guaranteed to trigger live in front of the client on the very first right-swipe of that card, not a matter of luck.
- Pre-seed one match already in an active chat with a couple of prior messages, so the chat screen doesn't look empty when opened.

Building this seed script is its own ticket (see Demo Ticket List) — treat it as equally important as any feature ticket, not an afterthought.

---

## 5. Definition of Done for the Demo

The demo is done when a person unfamiliar with the codebase can do the full journey in §1 on a real device (via Expo Go or an EAS preview build), without the builder narrating or intervening, and the app doesn't visibly break, lag, or show placeholder/lorem-ipsum content anywhere in that path.

It is explicitly **not** done when: all 13 epics of the original ticket list are implemented, when it's deployed to real AWS infra, when it's passed a security review, or when it's live on the App Store/Play Store. Those are the next project, not this one.

---

## 6. Explicit Non-Goals (repeat of original PRD §9, still fully true here, plus demo-specific additions)

Everything the original PRD excludes from V1 is still excluded here. Additionally, for the demo specifically, do **not** build:
- Any AWS-managed service (RDS Multi-AZ, ElastiCache, SQS, OpenSearch, SNS/SES, ECS/Fargate, Terraform) — see Demo Architecture doc for the lightweight substitute stack.
- A separate Python NLP microservice.
- Row-Level Security policies, verification workflows, or a moderation queue.
- Real push notifications, real calendar sync, real SMS/OTP.
- App Store/Play Store submission — the deliverable is an Expo Go / EAS preview link, not a published listing.
