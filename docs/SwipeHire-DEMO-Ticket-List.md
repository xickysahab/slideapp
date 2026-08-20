# SwipeHire — DEMO Engineering Ticket List
### Scope: Client Showcase Build — sequenced, trimmed, with realistic tool/session estimates

---

## 0. How to Use This List

Same ticket format as the original `SwipeHire_Engineering_Ticket_List.md` (Type, Description, Acceptance Criteria, Dependencies), but re-scoped end-to-end for the Demo PRD/Architecture/Frontend Spec/Security Baseline above. Work top to bottom — later phases depend on earlier ones.

**Tool suggestion per ticket** is a starting point, not a rule: `Claude Code` for anything multi-file/architectural/backend-heavy (it can hold the whole module in context and follow `CLAUDE-DEMO.md`); `Cursor` for fast, visual, in-editor iteration (mostly frontend polish, one screen at a time). Swap freely based on what's actually working better for you.

**Session estimate** assumes a focused session, not wall-clock days — actual calendar time depends on your Claude Pro weekly cap resets (see the usage-limits conversation above) and how much manual testing/debugging happens between AI-assisted chunks.

---

## PHASE 0 — Project Setup (~2–3 sessions)

**DEMO-00 — Repo & Environment Scaffolding**
Type: INFRA · Tool: Claude Code
Set up the monorepo (or two repos: `swipehire-mobile`, `swipehire-api`), NestJS project bootstrap with the module skeleton from Demo Architecture §2, Expo project bootstrap with New Architecture enabled, `docs/` folder holding all 5 demo documents + `CLAUDE-DEMO.md`.
**Acceptance:** NestJS app boots locally with a health-check endpoint; Expo app boots and shows a placeholder screen; both are in version control.
**Dependencies:** None.

**DEMO-01 — Database Provisioning**
Type: DB, INFRA · Tool: Claude Code
Provision a Neon or Supabase Postgres instance, enable `pgvector`, run the schema from Demo Architecture §3 as an initial migration.
**Acceptance:** All 9 tables exist; `pgvector` extension confirmed enabled; connection string works from local NestJS app.
**Dependencies:** DEMO-00.

**DEMO-02 — File Storage Setup**
Type: INFRA · Tool: Claude Code
Provision a single private S3 bucket (or Supabase Storage bucket), wire up presigned URL generation in the backend.
**Acceptance:** Backend can generate a presigned PUT URL and a presigned GET URL for a test object.
**Dependencies:** DEMO-00.

---

## PHASE 1 — Auth & Profiles (~4–6 sessions)

**DEMO-03 — Auth Module**
Type: BE · Tool: Claude Code
Email/password signup+login, Google OAuth, JWT access+refresh issuance per Demo Security Baseline §1.
**Acceptance:** A user can sign up, log in, receive a valid access token, and hit a protected route; wrong password is rejected with a generic error.
**Dependencies:** DEMO-01.

**DEMO-04 — Role Selection & Basic Profile**
Type: FE, BE · Tool: Cursor (screens) + Claude Code (API)
Role-select screen, candidate/recruiter basic-info form, `PATCH /profile` endpoint.
**Acceptance:** A new user can pick a role and submit basic profile info that persists to `profiles`/`candidate_profiles`/`companies`.
**Dependencies:** DEMO-03.

**DEMO-05 — Resume Upload & Parsing**
Type: FE, BE · Tool: Claude Code (parsing logic), Cursor (upload UI)
Presigned upload flow, `pdf-parse` text extraction, skills-taxonomy keyword matcher, review/edit screen for extracted skills.
**Acceptance:** Uploading a real PDF resume results in a visibly non-empty, editable skills list on the review screen within a few seconds.
**Dependencies:** DEMO-02, DEMO-04.

**DEMO-05b — (Optional) Embeddings API Integration**
Type: BE · Tool: Claude Code
Wire up a hosted embeddings API call for resumes and job descriptions, populate `resume_embedding`/`jobs.embedding`.
**Acceptance:** Embedding vectors are populated and a cosine-similarity query returns sane-looking scores between a known-similar resume/job pair.
**Dependencies:** DEMO-05. **Skip this ticket entirely if time is tight — see Demo Architecture §5 for the fallback scoring formula.**

---

## PHASE 2 — Jobs & Discovery (~3–4 sessions)

**DEMO-06 — Job Creation**
Type: FE, BE · Tool: Cursor (form), Claude Code (API)
Simple job-creation form → `jobs` table.
**Acceptance:** A recruiter can create a job listing with title, description, tech stack, comp band, location/work mode; it appears in that recruiter's job list.
**Dependencies:** DEMO-04.

**DEMO-07 — Match Scoring**
Type: BE · Tool: Claude Code
Implement the simplified scoring formula (Demo Architecture §5) as a service callable at deck-fetch time.
**Acceptance:** Given a candidate and a job, the endpoint returns a 0–100 score that visibly differs across different candidate/job pairs in seed data.
**Dependencies:** DEMO-05 (and DEMO-05b if using embeddings), DEMO-06.

**DEMO-08 — Discovery Feed Endpoints**
Type: BE · Tool: Claude Code
`GET /discover/jobs` (candidate side), `GET /discover/candidates?jobId=` (recruiter side), excluding already-swiped targets, cursor-paginated.
**Acceptance:** Both endpoints return a ranked list of cards with match scores, excluding anything the requester already swiped on.
**Dependencies:** DEMO-07.

---

## PHASE 3 — Swipe Deck UI (~5–7 sessions — the centerpiece, budget the most time here)

**DEMO-09 — Swipe Card Component & Gesture Stack**
Type: FE · Tool: Cursor (tight visual iteration loop) or Claude Code, your call
Build `SwipeCard`, `MatchSeal`, and the Reanimated + Gesture Handler drag/rotate/release logic per Demo Frontend Spec §1.
**Acceptance:** A card can be dragged, rotated, and flung left/right at 60fps on a real device via Expo Go, with the pass/shortlist overlay stamps.
**Dependencies:** None (can be built against static mock data before the backend is ready).

**DEMO-10 — Rolling Window & Deck Wiring**
Type: FE · Tool: Cursor
3-card rolling window rendering, wire the deck to `GET /discover/...`, swipe action → `POST /swipes`.
**Acceptance:** Swiping through a real deck (from DEMO-08) feels smooth with no visible stutter or remount flash between cards.
**Dependencies:** DEMO-08, DEMO-09.

**DEMO-11 — Job Card & Candidate Card Content**
Type: FE · Tool: Cursor
Fill in the real card layouts per Demo Frontend Spec §1 (job card: company/logo/salary/skills; candidate card: blind-first initials/name, skills, match seal).
**Acceptance:** Cards visually match the Frontend Spec's layout spec, populated with real seed data, not lorem ipsum.
**Dependencies:** DEMO-10.

---

## PHASE 4 — Matching & Chat (~4–6 sessions)

**DEMO-12 — Match Detection & Creation**
Type: BE · Tool: Claude Code
Implement the synchronous match-check + creation flow from Demo Architecture §4, emit `match:created` over the open socket.
**Acceptance:** A mutual right-swipe produces exactly one `matches` row and both connected clients receive the event live.
**Dependencies:** DEMO-10.

**DEMO-13 — Match Celebration Screen**
Type: FE · Tool: Cursor
Full-screen "It's a Match!" UI, triggered by the `match:created` socket event.
**Acceptance:** Swiping right on the pre-seeded guaranteed match (Demo PRD §4) triggers this screen live, not after a manual refresh.
**Dependencies:** DEMO-12.

**DEMO-14 — Chat Module**
Type: FE, BE · Tool: Claude Code (gateway), Cursor (UI)
Socket.io chat gateway (single instance, no Redis adapter needed), `ChatBubble` UI, message persistence to `messages`.
**Acceptance:** Two accounts in a match can exchange messages in real time, and message history persists across app restarts.
**Dependencies:** DEMO-12.

**DEMO-15 — Matches List Screen**
Type: FE, BE · Tool: Cursor
List of a user's active matches with last-message preview.
**Acceptance:** Matches list shows all active matches, tapping one opens the correct chat thread.
**Dependencies:** DEMO-14.

---

## PHASE 5 — Interview Scheduling (~2–3 sessions)

**DEMO-16 — Slot Propose/Accept Flow**
Type: FE, BE · Tool: Claude Code (API), Cursor (UI)
`InterviewSlotCard` inline chat component, propose endpoint (recruiter), accept endpoint (candidate), per the simplified single-round flow in Demo PRD §2 row 18.
**Acceptance:** A recruiter can propose slots inside a chat thread; the candidate sees them as an interactive card and can accept one; both sides see the confirmed state update live.
**Dependencies:** DEMO-14.

---

## PHASE 6 — Seed Data & Polish (~3–5 sessions — do not skip or shortcut this phase)

**DEMO-17 — Seed Data Script**
Type: BE, QA · Tool: Claude Code
Build the seed script described in Demo PRD §4: 15–20 jobs, 15–20 candidates, varied match scores, one guaranteed pre-matched pair, one pre-seeded chat with prior messages.
**Acceptance:** Running the seed script against a fresh database produces a deck that looks populated and realistic on first launch, with the guaranteed match ready to trigger on the very first right-swipe.
**Dependencies:** DEMO-06, DEMO-07, DEMO-14.

**DEMO-18 — Empty/Loading/Error State Pass**
Type: FE · Tool: Cursor
Wire up `LoadingState` (skeleton), `EmptyState`, and `ErrorState` on the deck and matches list per Demo Frontend Spec §6.
**Acceptance:** A cold app launch, an exhausted deck, and a simulated network failure all show a designed state, never a blank screen or raw error.
**Dependencies:** DEMO-10, DEMO-15.

**DEMO-19 — End-to-End Dry Run**
Type: QA · Tool: You, not the AI tools
Run the full Demo PRD §1/§3 journey start to finish on a real device, both roles, timing it.
**Acceptance:** The full journey completes in under 5 minutes with no crashes, no visible placeholder content, and no manual intervention beyond normal taps/swipes.
**Dependencies:** Everything above.

---

## PHASE 7 — Deployment (~1–2 sessions)

**DEMO-20 — Backend Deploy**
Type: INFRA · Tool: Claude Code (config) + you (account setup)
Deploy the NestJS backend to Railway or Render, point it at the Neon/Supabase database.
**Acceptance:** The deployed backend URL responds correctly from the Expo app running on a real device off your local network.
**Dependencies:** DEMO-01 through DEMO-16 complete and working locally.

**DEMO-21 — Mobile Preview Build**
Type: INFRA · Tool: You (EAS account setup) + Claude Code (config)
`eas build` a preview build (or confirm Expo Go works end-to-end against the deployed backend), generate a shareable install link/QR code.
**Acceptance:** A person on a different phone, with no dev environment, can scan the link/QR and run the full demo journey.
**Dependencies:** DEMO-20.

---

## Total Rough Estimate

**~24–35 focused sessions** across all phases, depending on how much of the "optional" work (onboarding slides, embeddings, job management analytics) you include. Spread across a Claude Pro weekly-cap rhythm, budget this as **2–4 weeks of consistent evening/weekend work**, not a few days — Phase 3 (swipe deck feel) and Phase 6 (seed data + polish) are usually where time actually goes, more than raw feature count suggests.

**If the client deadline is tighter than that:** cut Phase 5 (interview scheduling) entirely and end the demo journey at "match → chat" — that's still a complete, convincing proof of the core mechanic, and it's the single biggest phase you can drop without damaging the story.
