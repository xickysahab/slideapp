# SwipeHire — CLAUDE.md (DEMO BUILD)
### Project Constitution for Claude Code + Cursor — Demo Scope Only

---

## 0. This Replaces the Full-Spec CLAUDE.md For This Build

If you (or a past session) already generated a `CLAUDE.md` from the original 5 full-spec documents (`swipehire-prd.md`, `SwipeHire_Technical_Architecture.md`, `SwipeHire_Frontend_Specification.md`, `SwipeHire_Security_Access_Document.md`, `SwipeHire_Engineering_Ticket_List.md`) — **that file describes a different, bigger project.** Use *this* file and the 5 documents it points to instead, for as long as the goal is "build a demo to show a client." Don't mix instructions from the two — if you find yourself about to provision AWS infra or build the admin dashboard, you've drifted back into the full-spec build by mistake.

Same two operating rules as before, just against a smaller spec:

1. **Build exactly what the demo docs specify — don't add scope back in because it seems natural, and don't quietly cut further than they already cut.**
2. **Don't skip anything the Demo Ticket List marks as required.** The whole point of trimming the spec was to make "don't leave anything out" achievable in a real timeframe — that discipline doesn't relax just because the project got smaller.

---

## 1. Source Documents for This Build

**The five demo planning specs this file was written against have been removed.** The build is done;
they described what to build, and `docs/handoff/` now describes what exists. Where the two would
have disagreed, the handoff documents follow the code — they were written by reading it.

| File | Role |
|---|---|
| `handoff/PRD.md` | What the product is, scope as built, product principles, definition of done |
| `handoff/Architecture.md` | Stack, 11-table schema, swipe/match/chat/resume flows, auth, scoring, deploy |
| `handoff/Backend.md` | The full API contract — every endpoint, payload and error shape |
| `handoff/Frontend.md` | Design system, navigation, screens, the swipe gesture, accessibility |
| `handoff/Security.md` | What is defended, what is deliberately not, and where the line is |
| `handoff/Ticket-List.md` | The build plan with verified status |
| `SwipeHire-DEMO-Journey-Map.md` | The client's journey diagram mapped onto scope, and the DEMO-16b addition |
| `DEPLOY.md` | Deployment procedure. The only copy — deliberately not duplicated into `handoff/` |

The 8 full-spec documents are still in `docs/full-spec/` (keep them — they're the real spec for
later) but are **not** what this build follows. If a handoff doc doesn't cover something you need,
check the full-spec doc for the underlying idea, then re-scope it down the same way this build
already did elsewhere — don't implement the full-spec version wholesale.

**Section numbers moved when the docs were rewritten.** The old Security Baseline's §1 (keep these) is
now `handoff/Security.md` §1, its §2 (skipped) is §3, and its §3 (the hard line) is §4.

---

## 2. The One Thing Not to Compromise On

Every cut in these demo docs was made for speed. None of them were made carelessly. Two things are called out repeatedly across the demo docs as **not** okay to cut even under time pressure, because they're cheap and they're what makes this look like real engineering instead of a mockup:

- **Server-side ownership checks on every resource-ID endpoint**, and **matches only ever created server-side from two real swipes, never client-submitted** (`handoff/Security.md` §1).
- **The swipe deck's gesture/animation feel** (`handoff/Frontend.md` §1 and §4, `handoff/Ticket-List.md` Phase 3) — a laggy or janky swipe card undermines the entire demo faster than any missing feature would, since it's the first thing the client's hands touch.

If a deadline is genuinely forcing a cut, cut a whole Phase from the Ticket List (Phase 5, interview scheduling, is the designated first thing to drop — see the Ticket List's closing note) before compromising either of these two.

---

## 3. Tool Workflow (Claude Code + Cursor)

- **Claude Code**: backend modules, database/migration work, anything spanning multiple files or requiring the full module context, and anything where following this `CLAUDE.md` + the demo docs precisely matters more than visual iteration speed.
- **Cursor**: screen-by-screen frontend work, visual polish, fast in-editor fixes where you're watching the simulator/device live.
- Both tools read the same `/docs` folder and the same schema/API contracts — if you change an API shape while working in one tool, update the relevant demo doc before switching to the other tool for the matching side, so they don't drift out of sync with each other.
- Neither tool removes the other's usage limits — budget calendar time per the Demo Ticket List's session estimates, not just tool-switching as a way to "get more done per day."

---

## 4. Hard "Do Not" List (Demo-Specific)

In addition to the general discipline from the full-spec CLAUDE.md (don't swap chosen libraries without flagging, don't invent scope, don't skip acceptance criteria):

- Do not provision any AWS service, Terraform, or Docker/ECS setup — see Demo Architecture §1 for the deploy target (Railway/Render + Neon/Supabase + EAS).
- Do not build the admin dashboard, moderation queue, recruiter verification workflow, filters UI, push notification setup, or calendar sync — all explicitly cut in Demo PRD §2/§6.
- Do not skip the seed-data ticket (DEMO-17) or treat it as optional polish — an empty deck is a failed demo, not a minor gap.
- Do not publish this build to the App Store or Play Store — the deliverable is an Expo Go session or an EAS preview link (Demo Ticket List, DEMO-21).
- Do not share a live link to this build outside the specific client meeting — see Demo Security Baseline §3.
- Do not silently start re-adding full-spec complexity (Redis, SQS, RLS, a separate NLP service) because it "wouldn't take that long" — if it feels worth adding, flag it and check whether it actually serves the demo's five-minute proof surface (Demo PRD §1) before building it.

---

## 5. Ask, Don't Assume (Demo-Specific)

Stop and ask before proceeding when:
- A ticket in the Demo Ticket List references a full-spec detail (e.g., an exact scoring weight) that isn't restated in the demo docs — check the demo doc's simplified version first; if it's genuinely not covered, ask rather than pulling the full-spec number in wholesale.
- You're unsure whether something is "cut for the demo" or "cut from the product entirely" — almost everything here is the former (see each demo doc's §0/§8 "how to go from demo to real" notes), but don't assume that silently for something not explicitly addressed.
- The client deadline changes and you need to decide what to cut further — use the Demo Ticket List's own guidance (drop Phase 5 first) rather than improvising a different cut.

---

*This file and the 5 demo documents in `/docs` are the spec for this build. The original full-spec documents and their `CLAUDE.md` are the spec for the real product, later.*
