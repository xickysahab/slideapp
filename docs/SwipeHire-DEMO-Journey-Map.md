# SwipeHire — DEMO Journey Map
### Mapping the client user-journey diagram onto the demo build

---

## 0. What This Document Is

`swipehire-user-journey.svg` (in this folder) is the flow diagram for the product. The requirement
for this build is that **the demo walks that diagram end to end** — a person holding the phone should
be able to reach every terminal node without hitting a dead end or a "coming soon" screen.

Most of the diagram was already in scope. This document exists to record three things so no future
session (Claude Code or Cursor) has to re-derive them:

1. Which diagram nodes are already covered by the demo docs, unchanged.
2. Which nodes are covered but implemented differently under the hood (invisible to the user).
3. Which nodes were cut by the demo docs, what was decided about each, and what the user sees instead.

**Authority:** this document does not override the other demo docs. Where it differs, it is recording
an explicit decision made with Aagam, and says so. Everything else still defers to
`SwipeHire-DEMO-PRD.md` / `-Architecture.md` / `-Frontend-Spec.md` / `-Security-Baseline.md`.

---

## 1. The Diagram

```
App Launch
 └─ New User?
     ├─ No  ──→ Login ──────────────────────────────┐
     └─ Yes ──→ Select Role: Job Seeker or Recruiter │
          │                                          │
          ├─ Job Seeker Onboarding                   │
          │    → Upload Resume                       │
          │    → NLP Service Extracts Skills & Experience
          │    → Review and Edit Auto-Filled Profile │
          │    → Set Preferences: Location, Salary, Remote
          │    → Job Seeker Swipe Deck ◄─────────────┘
          │         ├─ Swipe Left ──→ back to deck
          │         └─ Swipe Right on Job?
          │              → Record Swipe
          │              → Mutual Right Swipe Exists?
          │                   ├─ No  → Store Pending Swipe
          │                   └─ Yes → Match Created + notify both parties
          │                        → Real-Time Chat Unlocked
          │                        → Recruiter Proposes Interview Slots
          │                        → Candidate Confirms Slot
          │                        → Calendar Invite Synced
          │                        → Interview Scheduled
          │                        → Outcome
          │                             ├─ Hired        → Job Marked Filled, Match Archived
          │                             └─ Not Selected → Match Closed, Optional Feedback Prompt
          │
          └─ Recruiter Onboarding
               → Company / Recruiter Verification
               → Create Job Listing
               → Define Required Skills and Filters
               → Recruiter Candidate Swipe Deck
                    ├─ Swipe Left ──→ back to deck
                    └─ Swipe Right on Candidate? ──→ (joins the Mutual Right Swipe check above)
```

---

## 2. Node-by-Node Status

### 2.1 Covered as-is — build exactly per the demo docs

| Diagram node | Where it's specified |
|---|---|
| App Launch | Frontend Spec §2, Splash screen |
| New User? | Frontend Spec §4, `OnboardingStack` |
| Select Role: Job Seeker or Recruiter | Frontend Spec §2 candidate #3 / recruiter #1 |
| Job Seeker Onboarding | PRD §2 row 1, Ticket `DEMO-04` |
| Upload Resume | PRD §2 row 5, Ticket `DEMO-05` |
| Review and Edit Auto-Filled Profile | Frontend Spec §2 candidate #8 — explicitly "important to keep" |
| Set Preferences: Location, Salary, Remote | Frontend Spec §2 candidate #9 (trimmed: salary band + work mode; industries skipped) |
| Job Seeker Swipe Deck | PRD §2 row 8/10, Tickets `DEMO-09`–`DEMO-11` — **the centerpiece** |
| Swipe Left → back to deck | PRD §2 row 13 |
| Swipe Right on Job? | PRD §2 row 13 |
| Mutual Right Swipe Exists? | Architecture §4 step 2 |
| Store Pending Swipe | Architecture §4 step 1 — the `swipes` row simply exists with no match created |
| Match Created | Architecture §4 step 3, Ticket `DEMO-12` |
| Real-Time Chat Unlocked | PRD §2 row 17, Ticket `DEMO-14` |
| Recruiter Proposes Interview Slots | PRD §2 row 18, Ticket `DEMO-16` |
| Candidate Confirms Slot | Ticket `DEMO-16` |
| Interview Scheduled | Ticket `DEMO-16`, surfaced on the matches list |
| Recruiter Onboarding | PRD §2 row 2, Ticket `DEMO-04` |
| Create Job Listing | PRD §2 row 7, Ticket `DEMO-06` |
| Recruiter Candidate Swipe Deck | PRD §2 row 9/10, Tickets `DEMO-09`–`DEMO-11` |
| Swipe Right on Candidate? | PRD §2 row 13 |

### 2.2 Covered, but implemented differently — user sees no difference

These are the demo's infrastructure simplifications (Architecture §1). The diagram node still
happens; only the machinery behind it changed. **Do not re-add the full-spec infrastructure.**

| Diagram node | Demo implementation | What the user sees |
|---|---|---|
| **NLP Service Extracts Skills and Experience** | Folded into the NestJS backend — `pdf-parse` text extraction + a hardcoded skills-taxonomy keyword matcher. No separate Python service, no LLM fallback. (Architecture §6) | Identical: a short "Extracting your skills…" step, then a populated, editable skill list. Years-of-experience is a form field during onboarding rather than parsed — per Architecture §6 step 4. |
| **Record Swipe in Redis Queue** | Direct `INSERT ... ON CONFLICT` into the `swipes` Postgres table, synchronous. No Redis, no queue. (Architecture §1, §4) | Nothing — it's a sub-10ms server-side write either way. |
| **Match Created + Push Notification to Both Parties** | Match creation is unchanged and real (server-derived, unique-constraint-guarded). The *notification* is a `match:created` Socket.io event → in-app "It's a Match!" screen + badge. No APNs/FCM. (PRD §2 row 16, Architecture §1) | The match moment fires live on both devices with the app open — which is the demo condition anyway. A backgrounded-app system push does not fire. |
| **Define Required Skills and Filters** | Skill chip picker only. The **filters** half is cut (PRD §2 row 11) — the deck shows everything unfiltered. (Frontend Spec §2 recruiter #5) | Recruiter picks required skills for the listing; there is no filter sheet on either deck. |

### 2.3 Cut by the demo docs — decisions recorded

| Diagram node | Decision | What the demo does instead |
|---|---|---|
| **Login / Biometric Auth** | Login: **build.** Biometric: **skip.** (Frontend Spec §2 candidate #4 "no phone OTP, no biometric"; Security Baseline §2) | Email/password + Google OAuth. Returning users land straight in the deck from a stored refresh token, so the "No → Login → Deck" branch of the diagram still walks. Biometric is a noted gap, not a broken path. |
| **Company / Recruiter Verification** | **Skip the screen.** (PRD §2 row 4 and row 20 — every recruiter is auto-marked verified) | `companies.verified` defaults to `true`. The **Verified badge still renders** on the company profile and on job cards, so the trust signal is visible in the demo — there is just no verification step to pass through. Recruiter onboarding goes Company Setup → Create Job Listing directly. |
| **Calendar Invite Synced** | **Skip.** (PRD §2 row 18 and §6 — explicitly cut; needs Google Calendar OAuth scopes) | The flow goes Candidate Confirms Slot → **Interview Scheduled** directly. The confirmed slot shows in the chat thread and on the matches list. No calendar node, and no dead-end screen. |
| **Push Notification** | **Skip real push.** (PRD §2 row 16) | See §2.2 — in-app socket event + toast/badge. |
| **Outcome / Hired / Not Selected / Job Marked Filled, Match Archived / Match Closed, Optional Feedback Prompt** | **BUILD — this is the one scope addition.** See §3. | New ticket `DEMO-16b` below. |

---

## 3. DEMO-16b — Outcome & Match Closure (scope addition)

**This ticket is not in `SwipeHire-DEMO-Ticket-List.md`.** It was added deliberately so the journey
diagram has a real ending instead of stopping at "Interview Scheduled." It is cheap — it is
application logic over columns the demo schema already has — which is why it was the one cut node
worth adding back.

Type: FE, BE · Tool: Claude Code (API + state transitions), Cursor (UI)
Slots in: **Phase 5**, immediately after `DEMO-16`.
Dependencies: `DEMO-16`.

### Behaviour

Once an interview is in the `confirmed` state, the **recruiter** — and only the recruiter, this is a
hiring decision — sees an "Update outcome" action on that match (chat header or matches-list row).
Two choices:

- **Hired** → `jobs.status = 'filled'`, `matches.status = 'archived'`.
  The job stops appearing in any candidate's deck. Both parties see the match move to an
  "Archived / Hired" state; the chat thread stays readable.
- **Not Selected** → `matches.status = 'closed'`, with an **optional** short feedback note from the
  recruiter, shown to the candidate. Skipping the note is a first-class path — the diagram itself
  says "Optional."

Both transitions emit a Socket.io event so the other party's screen updates live, same pattern as
`match:created`.

### Schema

Uses existing columns — `jobs.status` (`TEXT NOT NULL DEFAULT 'active'`) and `matches.status`
(`TEXT NOT NULL DEFAULT 'active'`) from Architecture §3. Status values in use for the demo:

- `matches.status`: `active` | `archived` | `closed`
- `jobs.status`: `active` | `filled`

**One new column is required** (flagged here rather than added silently, per `CLAUDE-DEMO.md` §4):

```sql
ALTER TABLE matches ADD COLUMN outcome_note TEXT;
```

Nullable, recruiter-authored, candidate-visible. Nothing else in the schema changes.

### Acceptance Criteria

- After an interview is confirmed, the recruiter can mark the match **Hired** or **Not Selected**.
- **Hired** sets the job to `filled` and the match to `archived`; that job no longer appears in any
  candidate's discovery deck.
- **Not Selected** sets the match to `closed` and optionally stores a feedback note; the candidate
  sees the note if one was written, and a clean closed state if not.
- The candidate's screen reflects the new state live over the socket, without a manual refresh.
- The outcome action is **recruiter-only** — a candidate calling the endpoint gets a `404`
  (per Security Baseline §1: server-side ownership check, `404` not `403` for "exists but not yours").
- Both terminal states render a designed state, never a blank screen or a raw status string.

### Seed-data implication (affects `DEMO-17`)

Seed **one match already in each terminal state** — one `archived`/Hired and one `closed`/Not Selected
with a feedback note — so the matches list shows the full lifecycle on first launch rather than an
all-`active` list. This is a small addition to the `DEMO-17` seed script, not a separate ticket.

---

## 4. Known Gaps to Name Out Loud If the Client Asks

Not defects — deliberate, recorded scope cuts. Worth being able to answer cleanly in the meeting:

- **Biometric login** — designed, not built for the demo. Needs a real device to show meaningfully.
- **Recruiter verification workflow** — the badge and the data model are there; the manual review
  queue and work-email-domain check are the production build (full-spec Security doc §10).
- **Calendar sync** — in-chat slot proposal is complete; two-way Google/Outlook sync is the
  production build (full Architecture §10.3).
- **Real push notifications** — the match/message events are real and already fire over the socket;
  routing them to APNs/FCM is a certificate-setup task, not an architecture change.
- **Filters on the deck** — cut for the demo (PRD §2 row 11); the scoring and ranking that a filter
  would sit on top of is already real.

Every one of these has a clean path back — the demo docs' §8 / §2 "demo to real" notes cover them.
