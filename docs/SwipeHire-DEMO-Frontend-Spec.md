# SwipeHire — DEMO Frontend Specification
### Scope: Client Showcase Build — same design system, trimmed screen set

---

## 0. What Changed From the Full Frontend Spec, and Why

**The visual design system is not simplified — it's the thing that makes this look like a real, funded product instead of a tutorial clone, and that's exactly what a client demo needs to sell.** Colors, type, the Match Seal, card layout, motion spec — all identical to `SwipeHire_Frontend_Specification.md`. Copy §2, §3, and §15 of that document verbatim into `theme/tokens.ts`.

What's cut is **screen count and peripheral features** — anything not on the direct path of the Demo PRD §3 journey.

---

## 1. Design System — Use As-Is

No changes to:
- Color palette (§2 of the full spec) — the paper/navy/indigo/gold direction, including the Match Seal gradient
- Typography (§3) — Fraunces / Inter / IBM Plex Mono, same type scale
- Component visual spec (§4) — `Button`, `Card`, `SkillChip`, `MatchSeal`, `BottomSheet`, etc.
- Card layouts (§5, §6) — job card and candidate card, exactly as specified, including the blind-first candidate card (initials avatar, first name + last initial pre-match)
- Swipe gesture/motion spec (§7) — drag thresholds, rotation, overlay stamps (pass/shortlist only — no fast-track stamp, since that gesture isn't built for the demo)
- Design tokens object (§15) — import directly

Reduced:
- **Rolling window / prefetching (§8):** still keep 3-card rolling window rendering, since it's what makes the deck feel smooth — that's cheap to build regardless of backend complexity, and a janky swipe deck is the single fastest way to undercut the whole demo. **Do not cut this.** What's cut is the network-layer sophistication behind it (debounced batch flush, offline SQLite queue) — for the demo, a single swipe can just be one API call, no batching needed.

---

## 2. Screens to Build

### Candidate flow

| # | Screen | Build for demo? | Notes |
|---|---|---|---|
| 1 | Splash | Yes | Simple — MatchSeal arc-sweep loader is a nice touch, keep it, it's cheap |
| 2 | Onboarding slides | Optional | Skip if time is tight — goes straight from Splash to Role Selection with no loss to the demo story |
| 3 | Role Selection | Yes | |
| 4 | Sign Up / Login | Yes, simplified | Email/password + Google OAuth only — no phone OTP, no biometric |
| 5 | Profile Setup — Basic Info | Yes | Name, target role, location, notice period |
| 6 | Resume Upload | Yes | |
| 7 | Resume Parsing Status | Yes, simplified | A single spinner + "Extracting your skills…" is fine — the full spec's 3-stage staged copy is a nice-to-have polish pass, not required |
| 8 | Review & Edit Auto-Filled Profile | Yes | Important to keep — this is a real, working feature (the parser genuinely ran), and editable chips are cheap to build |
| 9 | Preferences | Yes, trimmed | Salary band + remote/hybrid/onsite only — skip target industries |
| 10 | Job Discovery / Swipe Deck | **Yes — this is the centerpiece, full polish** | |
| 11 | Job Details | Yes | Full card expand on tap |
| 12 | Filters | **No** | Cut per Demo PRD §2 |
| 13 | Matches (list) | Yes | |
| 14 | Chat | Yes | Include the `InterviewSlotCard` inline system message — it's central to the demo journey |
| 15 | Interview Scheduling | Yes, simplified | Propose slots → accept, no calendar-sync confirmation state |
| 16 | Profile / Settings | Optional, minimal | A read-only "how recruiters see you" preview is a nice touch if time allows; notification prefs and account deletion are not needed |

### Recruiter flow

| # | Screen | Build for demo? | Notes |
|---|---|---|---|
| 1 | Onboarding | Optional, same as candidate | |
| 2 | Company Setup | Yes, trimmed | Name, logo, industry — skip size/website |
| 3 | Verification | **No** | Auto-verified per Demo PRD — skip the screen, show the "Verified" badge as already-on |
| 4 | Job Creation | Yes, simplified | Single-step form is fine, not multi-step |
| 5 | Define Required Skills & Filters | Yes, simplified | Skill chip picker only — skip must-have/nice-to-have tiering |
| 6 | Recruiter Candidate Swipe Deck | **Yes — centerpiece, full polish** | |
| 7 | Candidate Details | Yes | |
| 8 | Filters | **No** | |
| 9 | Matches (list) | Yes | |
| 10 | Chat | Yes, same component as candidate side | |
| 11 | Interview Scheduling | Yes, simplified | |
| 12 | Job Management | Optional | A simple list of the recruiter's own listings is enough; skip per-job analytics (views/matches/shortlist rate) |
| 13 | Profile / Settings | Optional, minimal | |

**Net: ~11 candidate screens + ~9 recruiter screens actually need building (several are shared components), versus 16 + 13 in the full spec.**

---

## 3. Components to Build

Same component inventory as the full spec §4.1, with these explicitly **not** needed for the demo: `FilterSheet`, notification preference toggles, session/device management list, `SegmentedControl` variants used only in settings. Everything else — `Button`, `Input`, `Card`, `SkillChip`, `MatchSeal`, `SwipeCard`, `BottomSheet`, `ChatBubble`, `EmptyState`, `LoadingState`, `ErrorState` — build as specified, since they're reused constantly across the screens that remain.

**Build `MatchSeal` and `SwipeCard` first and get them pixel-right before anything else** — everything about whether this demo "feels real" rides on those two components.

---

## 4. Navigation (Demo Version)

Same structure as the full spec §10, with `FilterSheet` and `JobManagementListScreen`'s analytics view removed:

```
RootStack
├── OnboardingStack        (Splash → [Onboarding, optional] → RoleSelect → Auth)
├── CandidateRootTabs
│   ├── DiscoverTab         → SwipeDeckScreen → JobDetailsScreen (push)
│   ├── MatchesTab          → MatchesListScreen → ChatScreen (push) → InterviewSchedulingModal
│   └── ProfileTab          → ProfileScreen (minimal)
└── RecruiterRootTabs
    ├── DiscoverTab          → JobSelectorHeader + SwipeDeckScreen → CandidateDetailsScreen (push)
    ├── JobsTab              → JobManagementListScreen (simple list) → JobCreateFlowStack (modal)
    ├── MatchesTab           → MatchesListScreen → ChatScreen (push) → InterviewSchedulingModal
    └── ProfileTab           → CompanyProfileScreen (minimal)
```

---

## 5. API Integration (Demo Version)

Same contract shapes as the full spec §11, pointed at the Demo Architecture's simplified endpoints. The differences worth calling out:

- **No polling/WebSocket-event dual path for resume parsing (§11.4)** — since parsing is synchronous in the demo backend (no queue), the upload request can just wait and return the parsed result directly, or poll once after a short fixed delay. No need to build both paths.
- **Swipe recording (§11.6)** — single-swipe requests, not the batched-array body. Simpler client code, and there's no debounce/flush timing to get right.
- **Push notifications (§11.8)** — cut. Match/message events arrive over the already-open Socket.io connection instead; no `POST /devices/register` needed.
- **Calendar sync (§11.9)** — cut, per Demo PRD.

---

## 6. Loading/Empty/Error States (Demo Version)

Keep the full spec's treatment (§13) wherever it's cheap — skeleton loaders on the deck and matches list in particular, since a bare spinner during a live demo reads as unfinished. You can skip the more exotic states that are unlikely to occur during a controlled demo (chat reconnection banner, calendar-sync fallback banner) but **do build the empty-deck and failed-network states** — if the client's own device has a network hiccup mid-demo, a blank white screen is far worse than a graceful "Couldn't load — Retry" card.

---

## 7. Accessibility (Demo Version)

Full WCAG-AA contrast and touch-target sizing (§12 rows on contrast/touch targets) — keep, they cost nothing extra since they're just correct token usage. The heavier asks — full `accessibilityLabel`/`accessibilityActions` VoiceOver/TalkBack fallback mode for the swipe deck — can be skipped for a demo build unless the client specifically needs to see an accessibility story; note it as a known gap rather than silently building it inconsistently.
