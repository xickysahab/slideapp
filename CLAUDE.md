# SwipeHire — DEMO BUILD (project root)

**This project follows [`docs/CLAUDE-DEMO.md`](docs/CLAUDE-DEMO.md), not the full-spec constitution.**

There is a `CLAUDE.md` one directory up (`/Users/aagamjain/Downloads/CLAUDE.md`) that describes the
full 16-week production SwipeHire build — AWS/Terraform, Redis swipe pipeline, RLS, admin dashboard,
a separate Python NLP service. **That is a different, bigger project. Ignore it for this build.**
If you find yourself about to provision AWS infra, stand up Redis/SQS, or build the moderation queue,
you have drifted into the wrong spec.

## Read these, in this order

| File | Role |
|---|---|
| [`docs/CLAUDE-DEMO.md`](docs/CLAUDE-DEMO.md) | **The constitution for this build.** Read first, every session. |
| [`docs/SwipeHire-DEMO-PRD.md`](docs/SwipeHire-DEMO-PRD.md) | Scope table, demo journey, seed-data requirement, definition of done |
| [`docs/SwipeHire-DEMO-Architecture.md`](docs/SwipeHire-DEMO-Architecture.md) | Stack, 9-table schema, swipe/match/chat/resume flows |
| [`docs/SwipeHire-DEMO-Frontend-Spec.md`](docs/SwipeHire-DEMO-Frontend-Spec.md) | Screens to build, design system (reused verbatim from full spec) |
| [`docs/SwipeHire-DEMO-Security-Baseline.md`](docs/SwipeHire-DEMO-Security-Baseline.md) | The minimum honest bar — §1 items are non-negotiable |
| [`docs/SwipeHire-DEMO-Ticket-List.md`](docs/SwipeHire-DEMO-Ticket-List.md) | The sequenced build plan (DEMO-00 → DEMO-21) |
| [`docs/SwipeHire-DEMO-Journey-Map.md`](docs/SwipeHire-DEMO-Journey-Map.md) | **Read alongside the ticket list.** Maps the client's user-journey diagram onto the demo scope, and records the one agreed scope addition (DEMO-16b). |
| [`docs/swipehire-user-journey.svg`](docs/swipehire-user-journey.svg) | The source journey diagram the demo must walk end to end |
| [`docs/full-spec/`](docs/full-spec/) | The original production spec. **Not what this build follows** — reference only. Two legitimate uses: copying the design system verbatim (`SwipeHire_Frontend_Specification.md` §2/§3/§15), and reading the "why" behind a decision the demo docs inherited. |

## Repo layout

```
swipehire-api/      NestJS backend (modular monolith) → Railway/Render
swipehire-mobile/   Expo / React Native app (New Architecture)
docs/               All demo specs — the source of truth
```

## The two things not to compromise on

Per `docs/CLAUDE-DEMO.md` §2:

1. **Server-side ownership checks on every resource-ID endpoint**, and **matches are only ever
   created server-side from two real swipes — never client-submitted.**
2. **The swipe deck's gesture/animation feel.** A janky card undercuts the demo faster than any
   missing feature.

If a deadline forces a cut, drop a whole Phase (Phase 5, interview scheduling, is the designated
first drop) before compromising either of these.

## Decisions already made for this build

- **Embeddings API: skipped.** Match scoring uses the fallback formula — skills overlap 80% +
  experience fit 20% (Demo Architecture §5). Ticket `DEMO-05b` is out of scope. `resume_embedding`
  / `jobs.embedding` columns and the HNSW indexes still get created so it stays a clean add-on.
- **Scope added back from the journey diagram:** the Outcome tail only
  (Hired / Not Selected → archive / close + optional feedback). See `DEMO-16b` in the Journey Map.
- **Scope confirmed still cut:** biometric auth, recruiter verification workflow, calendar sync,
  real push notifications (APNs/FCM). See the Journey Map for what replaces each in the demo.
- **Google sign-in: backend only, client side not built.** `POST /auth/google` verifies a Google ID
  token properly and is ready; nothing calls it. Google's flow needs a custom-scheme redirect that
  Expo Go can't provide now that Expo's auth proxy is gone, so wiring the client would mean moving
  the whole build off Expo Go onto EAS dev builds — slower iteration, for a second login button.
  Demo PRD §2 row 1 asks for "email+password **or** Google sign-in", and email/password is done and
  tested, so scope is met. Revisit only if the EAS decision gets made for other reasons.
