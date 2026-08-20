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

`http://localhost:3000/health` should return `{"status":"ok",...}`, and the app's placeholder screen
should show "Backend reachable".

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
- [ ] **DEMO-01** Database provisioning
- [ ] **DEMO-02** File storage setup
- [ ] Phase 1 — Auth & profiles (DEMO-03 → 05)
- [ ] Phase 2 — Jobs & discovery (DEMO-06 → 08)
- [ ] Phase 3 — Swipe deck UI (DEMO-09 → 11)
- [ ] Phase 4 — Matching & chat (DEMO-12 → 15)
- [ ] Phase 5 — Interview scheduling + outcome (DEMO-16, 16b)
- [ ] Phase 6 — Seed data & polish (DEMO-17 → 19)
- [ ] Phase 7 — Deployment (DEMO-20 → 21)

`DEMO-05b` (embeddings) is intentionally out of scope — match scoring uses the skills-80% /
experience-20% fallback formula.

## A note on sharing

Per [`docs/SwipeHire-DEMO-Security-Baseline.md`](docs/SwipeHire-DEMO-Security-Baseline.md) §3: this
build skips rate limiting, malware scanning, RLS and the rest of the production checklist. It is
built for a controlled walkthrough. Don't leave a public link to it standing.
