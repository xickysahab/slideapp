# SwipeHire — Product Requirements

**Status:** describes the demo build as it actually stands, verified against the source in
`swipehire-api/` and `swipehire-mobile/`. Where this differs from the original planning documents
in `docs/full-spec/`, this document is the one that matches the code.

---

## 1. What this is

A trust-first, mutual-intent hiring marketplace. Candidates swipe on jobs, recruiters swipe on
candidates **for one specific listing at a time**, and a match — created only when both sides have
swiped right on that same pairing — unlocks chat and in-chat interview scheduling.

It is deliberately not a dating-app clone. The swipe is a lightweight interest signal gating
something that still requires real information: a parsed resume, a real job description, and a
match score computed from actual data.

## 2. The one thing it has to prove

A person holding the phone, in under five minutes, with no narration:

> sign up → upload a resume → land in a populated swipe deck → right-swipe → a real "It's a Match!"
> → chat live → propose and accept an interview slot → see the outcome close the loop

The same journey works from the recruiter side. Both halves are built.

## 3. Product principles

These are the decisions everything else defers to.

**Relevant matching over volume.** Any trade that buys scale or speed with match quality is the
wrong trade. The deck is sorted by a real computed score, never by recency alone.

**Left swipes are silent and permanent.** A passed card never resurfaces, and the other party is
never told. This is load-bearing for the trust model, not a missing notification feature.

**Blind-first by default.** Before a match exists, a recruiter sees a first name, a last initial, a
headline, years of experience, skill chips and a match score. No surname, no email, no phone, no
resume. This is enforced in the API payload, not in the UI — the fields never leave the server, so
there is nothing for a client to reveal.

**A match is always derived, never asserted.** No endpoint anywhere accepts a match from a client.
It exists only as a server-computed consequence of two independent, authenticated swipes.

## 4. Scope — what is built

| Area | State |
|---|---|
| Email + password auth, role chosen at signup | Built |
| Google sign-in | **Server only.** `POST /auth/google` verifies an ID token properly. Nothing calls it — see §6 |
| Candidate profile: basics, preferences, skills | Built |
| Resume upload → PDF text extraction → skill matching → human review | Built |
| Recruiter profile + company | Built |
| Job creation, recruiter dashboard, multiple listings | Built |
| Candidate job deck, scored and sorted | Built |
| Recruiter candidate deck, scoped to one listing | Built |
| Swipe deck UI — gesture, stamps, 3-card rolling window | Built |
| Match scoring — skills 80% / experience 20% | Built, real, inspectable |
| Mutual matching, exactly-once | Built |
| Chat after match, live delivery | Built |
| In-chat interview slot proposal → accept → confirm | Built |
| Outcome: Hired / Not Selected, with optional feedback | Built |
| Unread badge, read receipts on the match list | Built |

## 5. Scope — what is deliberately not built

Each of these is a recorded decision, not an oversight.

| Not built | Why |
|---|---|
| Payments / monetisation | Out of scope for a demo of the core mechanic |
| Fast-Track / Super Swipe | The design tokens ship with the theme; the gesture, quota and priority queue do not |
| Semantic matching via embeddings | `resume_embedding` and `jobs.embedding` columns and both HNSW indexes exist and are empty. Scoring uses the documented skills/experience fallback. Turning it on later is config, not a migration |
| Calendar sync | In-chat slot proposal only. The `interviews` table has room for it |
| Real push notifications (APNs/FCM) | Live socket events cover the demo. A backgrounded app misses them |
| Recruiter verification workflow | `companies.verified` defaults to `true`. The Profile screen says so out loud rather than implying a check happened |
| Admin / moderation dashboard | No moderation surface exists |
| Reporting and blocking | Not built |
| Web client | Mobile only |
| Multi-recruiter company accounts | One recruiter per company, enforced by `recruiter_profiles` being keyed on `user_id` |
| Rate limiting, malware scanning, RLS | See `Security.md` §3 — deliberate, recorded cuts |

**One pattern is barred on principle, not on scope:** anything resembling AI-generated cover letters
or one-click mass-apply. That is a product-principle violation — it converts the mutual-intent
signal into spam, which is the exact failure the product exists to avoid.

## 6. On Google sign-in

The server side is complete and correct: it verifies the ID token with Google and checks
`email_verified` before trusting any claim. Accounts are matched on the verified address, so
signing up with a password and later using Google lands on the same account.

The client is not wired. Google's flow needs a custom-scheme redirect that Expo Go cannot provide
now that Expo's auth proxy is gone, so wiring it would mean moving the whole build off Expo Go onto
EAS dev builds — slower iteration, for a second login button. Email/password is done and tested, so
the requirement ("email+password **or** Google sign-in") is met.

## 7. Seed data

The demo is unwatchable against an empty deck, so seeded data is a requirement rather than a
convenience: 5 companies, 18 candidates, 18 job listings, and one candidate whose deck opens on a
100% match with a recruiter who has already swiped right — so the very first right-swipe fires a
real match, live.

`npm run seed` is safe to re-run. It clears only what it created, recognised by the
`@swipehire.demo` address.

**The pre-armed match is single-use.** Rehearsing the first swipe consumes it. Re-seed before the
real walkthrough.

## 8. Definition of done

- The full journey completes in under five minutes on a real device, both roles
- No placeholder content, no lorem ipsum, no empty decks
- Match scores are real numbers from real computation — never a hardcoded figure
- Every screen has a loading, empty and error state
- The backend is reachable from a phone off the local network
