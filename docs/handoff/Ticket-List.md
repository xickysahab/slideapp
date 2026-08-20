# SwipeHire — Build Plan and Status

The sequenced work breakdown, with what actually landed against each item. Status verified against
the source and the passing check scripts, not against a plan.

**Legend:** `[x]` done · `[~]` partially done · `[ ]` not started · `[—]` deliberately out of scope

---

## Phase 0 — Foundations

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-00** Repo and environment scaffolding | Two projects, `docker`-free local setup, `.env.example` for both halves |
| `[x]` | **DEMO-01** Database provisioning | Supabase Postgres, `pgvector` + `pgcrypto` + `citext`. **11 tables** — the plan said 9; `refresh_tokens` and `recruiter_profiles` were added for reasons recorded in `Architecture.md` §3 |
| `[x]` | **DEMO-02** File storage | Private Supabase bucket, PDF only, signed URLs both directions. `npm run verify:storage` — 6 checks |

## Phase 1 — Auth and profiles

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-03** Auth | Email + password, Argon2id, JWT access + server-side revocable refresh. `npm run verify:auth` — 21 checks. Google sign-in is complete **server-side** and deliberately not wired into the client (`PRD.md` §6) |
| `[x]` | **DEMO-04** Profile API and setup screens | Role select, candidate basics, preferences, recruiter/company setup |
| `[x]` | **DEMO-05** Resume upload and parsing | Signed upload, magic-byte sniffing, `pdf-parse` v2, ~90-entry skill taxonomy, human review screen. 11 unit tests on the matcher, plus `verify-resume.ts <file.pdf>` — 16 checks |
| `[—]` | **DEMO-05b** Embeddings API | Out of scope. Both vector columns and both HNSW indexes exist and are empty, so enabling it later is config rather than a migration |

## Phase 2 — Jobs and discovery

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-06** Job creation and recruiter dashboard | Multi-listing, `GET /jobs/mine` |
| `[x]` | **DEMO-07** Match scoring | Skills 80% / experience 20%, three-year taper. Pure function, 11 unit tests |
| `[x]` | **DEMO-08** Discovery feeds | Both decks, scored and sorted, cursor-paginated. Blind-first enforced in the payload. `npm run verify:jobs` — 29 checks |

## Phase 3 — Swipe deck

The centrepiece, and where the most time went.

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-09** SwipeCard, MatchSeal, gesture stack | UI-thread worklets, 3-card rolling window, angular-gradient seal |
| `[x]` | **DEMO-10** Deck wired to real discovery endpoints | |
| `[x]` | **DEMO-11** Card content from live data | Job and candidate card variants |

## Phase 4 — Matching and chat

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-12** Swipe recording and server-derived matching | Idempotent upsert, reciprocity check, exactly-once creation under race |
| `[x]` | **DEMO-13** Match celebration screen | Seal sweeps in; routes straight into the new conversation |
| `[x]` | **DEMO-14** Chat over Socket.io | REST write, socket delivery, single instance |
| `[x]` | **DEMO-15** Matches list | Previews, unread counts, read receipts, status |

## Phase 5 — Interview scheduling and outcome

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-16** Propose → accept | One round. Acceptance takes an *index* into the stored proposal, never a slot object from the request — otherwise a client could confirm a time never offered |
| `[x]` | **DEMO-16b** Hired / Not Selected | Hiring archives the match and fills the job; not-selected closes the thread with an optional note. Added back from the client's journey diagram |

Whole journey verified end to end: `npm run verify:loop` — **39 checks**, including the live socket
events, passing against the deployed backend.

## Phase 6 — Seed data and polish

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-17** Seed script | 5 companies, 18 candidates, 18 listings, a primed match, a live conversation, and both terminal states. Safe to re-run |
| `[x]` | **DEMO-18** States pass | Skeleton, empty and error states on every fetching screen, plus the unread badge and a way back from an exhausted deck |
| `[ ]` | **DEMO-19** End-to-end dry run on a device | **The one open item.** Explicitly a human task: walk the full journey on a real phone, both roles, timed, and confirm it comes in under five minutes with no placeholder content. No script covers whether it feels right in the hand |

## Phase 7 — Deployment

| | Ticket | Status |
|---|---|---|
| `[x]` | **DEMO-20** Backend deploy | Live on Render's free tier, Singapore. Both decks populated and `verify:loop` 39/39 against the deployed URL, including WSS through Render's proxy. Service URL kept out of this repo |
| `[~]` | **DEMO-21** Mobile preview build | `eas.json` ready. Needs an Expo account, and for iOS an Apple Developer account — see `../DEPLOY.md` §2 |

---

## What is left, in order

1. **DEMO-19** — the device dry run. Everything else is verified by script; this is the part that
   is not.
2. **DEMO-21** — a shareable build, if the demo needs to leave your laptop. Android is free and
   quick; iOS needs $99/year from Apple with no way around it.

### Optional, not blocking

- An icon set for the tab bar and card affordances
- A recruiter-side candidate details screen — currently a no-op push, since the pre-match card
  already carries everything that payload contains
- A faint halo behind the arc on the 56px Match Seal, visible only on close inspection

---

## Before real users

Not demo work, but the honest next list. Detail and reasoning in `Security.md` §3 and
`Architecture.md` §11.

1. Rotate the Supabase database password and service_role key — both were shared in plaintext
   during development
2. Refresh-token rotation with reuse detection; move to RS256
3. Rate limiting on auth and swipe endpoints
4. Row-Level Security as a second layer under the existing ownership checks
5. Malware scanning in the upload pipeline
6. Redis in front of the swipe path, and a queue for everything downstream of a match
7. Move deck scoring out of the application once the eligible set stops fitting in memory
