# SwipeHire — Demo Build

A client-showcase prototype of SwipeHire: a mutual-intent hiring marketplace where candidates swipe
on jobs, recruiters swipe on candidates for a specific listing, and a match — only ever created from
two real right-swipes — unlocks chat and in-chat interview scheduling.

This is **not** the production build. Scope, stack and security posture are deliberately trimmed;
see [`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/) for what that means and why.

## What it has to prove

A person holding the phone, in under five minutes, with no narration:
sign up → upload a resume → land in a populated swipe deck → right-swipe → real "It's a Match!" →
chat live → propose and accept an interview slot → see the outcome close the loop. Same journey from
the recruiter side.

## Layout

```
swipehire-api/      NestJS modular monolith  → Railway/Render
swipehire-mobile/   Expo / React Native      → Expo Go or an EAS preview build
docs/               The spec. Read docs/CLAUDE-DEMO.md first.
docs/full-spec/     The original production spec — reference only, not this build's plan.
```

## Running it locally

Backend:

```bash
cd swipehire-api && cp .env.example .env && npm install && npm run start:dev
```

Mobile, in a second terminal:

```bash
cd swipehire-mobile && cp .env.example .env && npm install && npx expo start
```

`http://localhost:3000/health` returns liveness; `/health/ready` also checks the database.
The app currently opens on the DEMO-09 swipe-deck harness, which runs on mock data and needs no
backend.

On a **physical** device, set `EXPO_PUBLIC_API_URL` in `swipehire-mobile/.env` to your Mac's LAN IP
(`http://192.168.x.x:3000`) — `localhost` resolves to the phone, not your machine.

## Stack

| | |
|---|---|
| Mobile | Expo SDK 57, React Native 0.86 (New Architecture), TypeScript, React Navigation |
| Backend | NestJS 11, TypeScript |
| Database | Postgres (Neon or Supabase), `pgvector` enabled |
| Real-time | Socket.io, single instance |
| Storage | Private S3 / Supabase Storage bucket, presigned URLs only |
| Deploy | Railway or Render (backend), Expo Go / EAS preview (mobile) |

No Redis, no queues, no AWS provisioning, no separate NLP service — those are production concerns
that a demo never exercises. Module boundaries and table names are kept aligned with the production
spec so re-adding that infrastructure later is additive rather than a rewrite.

## Build status

Working through [`docs/SwipeHire-DEMO-Ticket-List.md`](docs/SwipeHire-DEMO-Ticket-List.md).

- [x] **DEMO-00** Repo & environment scaffolding
- [x] **DEMO-01** Database provisioning — Supabase Postgres 17.6, 9 tables, pgvector enabled
- [x] **DEMO-02** File storage — private Supabase bucket, PDF-only, signed URLs both ways
      (`npx ts-node scripts/verify-storage.ts` re-checks the round trip)
- [ ] Phase 1 — Auth & profiles
  - [x] **DEMO-03** Auth — email/password, JWT access + revocable refresh
        (`scripts/verify-auth.ts`, 21 checks). Google sign-in is implemented server-side
        but deliberately not wired into the client — see CLAUDE.md.
  - [~] **DEMO-04** Profile API done and verified (`scripts/verify-profile.ts`).
        Role-select and profile-form screens still to build.
  - [x] **DEMO-05** Resume upload, PDF text extraction, skill matching
        (`scripts/verify-resume.ts <file.pdf>` + 11 unit tests on the matcher)
- [x] Phase 2 — Jobs & discovery
  - [x] **DEMO-06** Job creation + recruiter dashboard (`GET /jobs/mine`)
  - [x] **DEMO-07** Match scoring — skills 80% / experience 20%, 11 unit tests
  - [x] **DEMO-08** Discovery feeds, blind-first enforced server-side
        (`scripts/verify-jobs-discovery.ts`, 29 checks)
- [ ] Phase 3 — Swipe deck UI
  - [~] **DEMO-09** SwipeCard + MatchSeal + gesture — renders correctly on the iOS
        simulator. The "60fps" criterion still needs a human to drag a card; screenshots
        can't show feel.
  - [ ] **DEMO-10** Rolling window wired to real endpoints
  - [ ] **DEMO-11** Card content from seed data
- [x] Phase 4 — Matching & chat (backend)
  - [x] **DEMO-12** Swipe recording + server-derived match creation
  - [x] **DEMO-14** Chat over Socket.io, single instance
  - [x] **DEMO-15** Matches list with previews and unread counts
- [x] Phase 5 — Interview scheduling + outcome (backend)
  - [x] **DEMO-16** Propose → accept, one round
  - [x] **DEMO-16b** Hired / Not Selected closure
  - Whole journey verified end to end: `scripts/verify-loop.ts`, 39 checks incl. sockets
- [ ] Phase 6 — Seed data & polish (DEMO-17 → 19)
- [ ] Phase 7 — Deployment (DEMO-20 → 21)

`DEMO-05b` (embeddings) is intentionally out of scope — match scoring uses the skills-80% /
experience-20% fallback formula.

## A note on sharing

Per [`docs/SwipeHire-DEMO-Security-Baseline.md`](docs/SwipeHire-DEMO-Security-Baseline.md) §3: this
build skips rate limiting, malware scanning, RLS and the rest of the production checklist. It is
built for a controlled walkthrough. Don't leave a public link to it standing.
