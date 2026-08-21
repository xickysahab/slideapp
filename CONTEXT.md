# SwipeHire — Session Context

Written for whoever picks this up next, including a fresh session with none of the history. It
records what was built, what was decided and why, what bit us, and what is left.

**Read [`CLAUDE.md`](CLAUDE.md) first** for which spec governs this build, then this file for state.
[`docs/handoff/Backend.md`](docs/handoff/Backend.md) is the API contract.

Last updated: after the mobile app was wired to the real API and verified on the iOS simulator.

---

## 1. Where things stand

| Phase | State |
|---|---|
| 0 — Scaffolding, database, storage | Done |
| 1 — Auth, profiles, resume parsing | Done, both halves |
| 2 — Jobs, match scoring, discovery | Done |
| 3 — Swipe deck UI | Done, wired to live endpoints |
| 4 — Match creation, chat, matches list | Done |
| 5 — Interview scheduling, outcome closure | Done |
| 6 — Seed data, states pass | Done. The device dry run is not |
| 7 — Deployment | Config committed; needs a host account and an Expo account |

The whole journey works end to end. What has **not** happened is a deployment, a run on a physical
device, and a timed dry run — which is what DEMO-19 actually asks for and is explicitly the human's
job, not a tool's.

### Verified how

Backend has five scripts that drive the real HTTP surface against real storage and a real database,
then clean up after themselves. They are the fastest way to find out whether something broke:

```bash
cd swipehire-api && npm run start:dev    # in one terminal
npm run verify:loop                       # in another — 39 checks, includes live sockets
```

`verify:auth` (21), `verify:profile` (23), `verify:jobs` (29), `verify:storage` (6),
`verify:loop` (39), plus `npm test` for 22 unit tests on skill matching and match scoring.

### Verified by hand on the simulator

Candidate: log in → deck loads 15 ranked listings → shortlist the top card → "It's a Match!" fires
→ chat opens with the counterparty's full name → message sends and persists.
Recruiter: log in → dashboard of four listings → open a listing's deck → candidates ranked and
blind-first.

Interview propose → accept and the outcome sheet were driven through the interface afterwards, and
both work — including the live socket update, where accepting a slot as the candidate flipped the
recruiter's open chat to the confirmed state with no interaction at all.

### NOT verified in the UI

- **Resume upload.** Needs a PDF inside the simulator. The pipeline itself is covered by
  `verify-resume.ts` against a real file.

The simulator's text injection drops characters on long strings, which makes long-form entry
unreliable to drive. Worth knowing before trying to automate a flow that types a lot.

---

## 2. Decisions made in this session

Each of these was a real fork. They are recorded so they don't get silently re-litigated.

| Decision | Why |
|---|---|
| **Embeddings skipped** (`DEMO-05b`) | Demo Architecture §5 says to reweight to skills 80% / experience 20% when they're off. Columns and HNSW indexes still exist, so turning them on later is config, not a migration. |
| **Google sign-in: server only** | `POST /auth/google` verifies an ID token properly and is ready. Nothing calls it: Google's redirect needs a custom scheme Expo Go can't provide since Expo's auth proxy was removed, so wiring the client means moving to EAS dev builds. Demo PRD §2 asks for "email+password **or** Google", and email/password is done. |
| **Outcome tail added** (`DEMO-16b`) | The client's journey diagram ends at Hired / Not Selected; the demo docs never covered it. Agreed as the one scope addition. See `docs/SwipeHire-DEMO-Journey-Map.md`. |
| **Recruiter dashboard is the landing tab** | The spec's tree opens on a deck with a job selector in the header. A recruiter's deck only means anything relative to a listing, so choosing the listing is the first act. The spec's flow is the *first-run* path; the dashboard is the returning state, and the empty state covers first-run. |
| **Swipe deck kept** | It was never in question in the docs, but a mid-session flow description didn't mention swiping. It stays: every doc calls it the centrepiece. The dashboard is its entry point, not its replacement. |
| **Role chosen at signup** | Role select is a screen before the signup form (matching the journey diagram); the role travels in the signup request and the server treats it as fixed. |
| **Chat: REST write, socket delivery** | The full spec's gateway accepts sends over the socket. Two write paths means the match check and the closed-thread rule have to be right twice, and Security Baseline §1 names "re-validated on every single send" as the thing not to get wrong. |
| **Scoring in the app, not SQL** | Keeps it a pure, testable function a client can be walked through. It is also the first thing that would have to change under real load. |
| **No FlashList** | Cell recycling earns its dependency over hundreds of rows; a match list is a handful. |
| **Host: Render free tier, not Railway** | Railway was picked first, then reversed on cost — it has no free tier, only a trial credit then $5/month, and this deployment gets torn down after the demo. Render's free tier is the only remaining host that runs a persistent process with WebSockets, which Socket.io requires and every serverless free tier rules out. The trade is a 40–60s cold start after 15 minutes idle; the fix is a warm-up call before the demo, in `docs/DEPLOY.md` §5. `railway.json` stays committed as a paid fallback. |
| **Screens with labels-only tab bar** | Phosphor isn't installed and Frontend Spec §1 rules out substituting an emoji-style set, so it ships typographic rather than with the wrong icons. |

---

## 3. Five places this build departs from the demo schema

Demo Architecture §3 defines nine tables. This build has eleven, plus one added column. Each is its
own migration so the deviation is visible in history rather than folded in silently.

| # | Change | Why it was necessary |
|---|---|---|
| 1 | `CREATE EXTENSION citext` | §3 declares `users.email CITEXT` but only creates `vector` and `pgcrypto`. Running §3 verbatim fails outright. |
| 2 | `matches.outcome_note` | The Outcome tail (decision above). |
| 3 | `refresh_tokens` table | Security Baseline §1 requires server-side refresh storage; §3 has nowhere to put it, since the full spec's `sessions` table is among those dropped. Without it, logout can only ask the client to forget a token that stays valid for a month. |
| 4 | `recruiter_profiles` table | §3 keeps `companies` but drops the link between a recruiter and one. The recruiter journey sets the company up *before* posting a job, so `jobs.company_id` can't be the link — a recruiter with a company and no job yet would be unreachable from their own account. |
| 5 | `swipes.job_id` + two partial unique indexes | The big one. See below. |

### On #5, because it matters

§3 defines swipes as `UNIQUE (actor_id, target_id, target_type)` with no job column. The full spec's
version of the same table carries `job_id`, "populated when target_type='candidate'". Dropping it
changes behaviour twice over:

1. A recruiter who passes on a candidate for one listing loses them from every other listing's deck.
2. Match detection can't tell which job a recruiter's right-swipe was for — while `matches` is keyed
   `UNIQUE (candidate_id, job_id)`, per job. The two tables disagreed about what a swipe means.

The demo docs get away with it only because Demo PRD §3 has each recruiter create exactly one
listing. The dashboard is explicitly multi-job, so that assumption no longer holds.

The migration also splits the constraint in two, which the full spec does not. A single
`UNIQUE (…, job_id)` has a hole: Postgres treats NULLs as distinct, so every candidate→job swipe —
all of which have a null `job_id` — would never be seen as a duplicate. Two partial unique indexes
cover both shapes. Demo Architecture §4 calls this constraint a correctness property, and one that
silently covers half the rows is worse than none, because it looks like it works.

---

## 4. Things that bit us

Worth knowing before they bite again.

**`withSpring()` cannot be used inside an expression.** It returns an animation descriptor, not a
number, so `translateY.value + withSpring(...)` type-checks, bundles cleanly, and then crashes at
runtime with "Transform with key of translateY must be number or a percentage". It can only be
*assigned* to a shared value. This took the whole deck down and was invisible until the app ran.

**`fullWidth` with `flex: 1` collapses a button in a column.** Flex distributes *remaining* space,
and a content-sized card has none, so the button rendered as a hairline. Buttons that share a row
get their flex from a wrapper on the parent's side.

**TypeORM reads `undefined` in a `where` as "skip this condition", not as IS NULL.** The unread
count was counting every message from the other party. It needs `IsNull()`.

**Test fixtures must not share identifiers with seed data.** `verify-loop` located its test
candidate in the recruiter's deck by first name; the seed introduced a candidate with the same one,
so the recruiter swiped on the wrong person and every assertion after it failed pointing nowhere
near the cause. Fixtures now use ids, and clean up companies by id rather than by name.

**Adding a folder outside `src/` moves TypeScript's inferred rootDir.** Creating `scripts/` made
`nest build` emit `dist/src/main.js` while `start:prod` still ran `node dist/main` — which would
have broken the deploy. `scripts` is excluded from `tsconfig.build.json`.

**Supabase's direct connection is IPv6-only; Render's outbound is IPv4.** The deploy built fine and
then failed with ENETUNREACH on every database connection. The fix is the session pooler string
(`aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`), which has an A record. It works
from a laptop either way, so this is invisible until something is deployed.

**The lockfile must be generated by the same npm the build host uses.** Render installs the npm
bundled with `.node-version` (Node 22 → npm 10). `.nvmrc` carries the same pin, because Railway's
builder reads that file and not `.node-version`, and `engines.node` alone is a range that resolves
to Node 24 and npm 11. npm 11 nests `@emnapi/*` under
`@unrs/resolver-binding-wasm32-wasi`; npm 10 hoists them. `npm ci` reads that as an out-of-sync
lockfile and fails the build. Regenerate with `npx npm@10.9.2 install --package-lock-only`, and
verify with `npx npm@10.9.2 ci` — not `npm run build`, which reuses node_modules and cannot
catch it. This cost two failed deploys.

**Supabase's storage gateway rejects `Content-Type: application/json` with an empty body**, which is
exactly the shape of the upload-signing call. The header is only sent when there is a body.

**pdf-parse v2 is a class, not a function.** `new PDFParse({ data })`, then `getText()`, then
`destroy()` in a `finally` — the handle leaks otherwise. `@types/pdf-parse` is for v1 and conflicts.

**The regex boundary for skill matching is asymmetric on purpose.** A consuming boundary that
excluded `.` (to stop "Node" matching inside "Node.js") also silently dropped "Kubernetes." at the
end of a sentence — the far commoner case. Leading excludes `.`, trailing allows it. There are
tests for every one of these cases.

---

## 5. Accounts and services

| Service | State |
|---|---|
| Supabase (Postgres + Storage) | Live. Project ref is in `swipehire-api/.env`, which is git-ignored. |
| GitHub | `github.com/xickysahab/slideapp`, **public** — chosen knowingly after the tradeoffs were laid out. |
| Google OAuth | Not created. Only needed if the client-side decision is revisited. |
| Render | **Live**, free tier, Singapore. Service URL is in `RENDER-ENV.txt` (git-ignored) rather than the README, because this repo is public and the README already carries the demo password. Railway was considered and rejected on cost; see §2. |
| Expo / EAS | Not created. Needed for DEMO-21. |

### Secrets

Nothing secret is in the repo. `.env` is git-ignored; `.env.example` carries placeholders only, and
every commit was checked for leaked values before pushing.

Two credentials were shared in chat during this session and both should be rotated before this goes
anywhere real: the Supabase database password, and the Supabase **service_role** key — the latter
bypasses RLS and has full database access, so it matters more than the password does.

### Local machine

Xcode 26.6 is installed and `xcode-select` points at it. iOS 26.2 and 26.4 simulator runtimes are
available, so no extra download is needed.

---

## 6. What is left

**DEMO-18 — states pass.** Mostly done already: skeletons, error states and empty states are built
and in use on the deck, the matches list, the dashboard and chat. What remains is a sweep to catch
anything missed.

**DEMO-19 — dry run.** The ticket says "Tool: You, not the AI tools". Run the full journey on a real
phone, both roles, timed, and confirm it comes in under five minutes with no placeholder content.

~~**DEMO-20 — backend deploy.**~~ Done. Render free tier, same Supabase database.
`verify:loop` passes 39/39 against the deployed URL, including the live socket events — the one
thing this deploy genuinely changed, since WSS now goes through Render's proxy rather than a local
port. `swipehire-mobile/.env` points at it.

The deploy cost two rounds: `DATABASE_URL` has to be Supabase's **session pooler**, because the
direct host has no A record at all (`dig A db.<ref>.supabase.co` returns nothing) and Render's
outbound is IPv4. No code fix exists for that — it is purely which string is in the dashboard.

**DEMO-21 — mobile build.** Either confirm Expo Go works against the deployed backend, or produce an
EAS preview build. Remember `EXPO_PUBLIC_API_URL` has to point at the deployed URL, not localhost.

### Smaller, optional

- Phosphor icons for the tab bar and card affordances
- Recruiter-side candidate details screen (currently a no-op push; the pre-match card already
  carries everything that payload contains)
- A faint grey halo behind the arc on the 56px Match Seal, visible only on close inspection

### Deliberately not doing

Push notifications, calendar sync, recruiter verification workflow, deck filters, Fast-Track, admin
dashboard, moderation, RLS, rate limiting, malware scanning. Every one is a recorded cut, not an
oversight — see `docs/SwipeHire-DEMO-Journey-Map.md` §2.3 and `docs/handoff/Backend.md` §12.

---

## 7. Before anyone shares this

Demo Security Baseline §3 is the line: this build skips rate limiting, malware scanning, RLS and the
rest of the pre-launch checklist. It is built for a controlled walkthrough, and that is fine. It is
not fine as an accidentally-public product. Don't leave a live link standing after the meeting.
