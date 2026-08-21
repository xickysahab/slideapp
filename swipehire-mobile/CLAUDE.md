@AGENTS.md

# SwipeHire Mobile — demo build

The spec for this app lives one level up, in [`../docs/`](../docs/). Read
[`../CLAUDE.md`](../CLAUDE.md) first if you opened this folder directly — it explains which
constitution applies (the **demo** one, not the full-spec one in the grandparent directory).

Most relevant here:

- [`../docs/handoff/Frontend.md`](../docs/handoff/Frontend.md) — design system, navigation tree,
  screens, the swipe gesture spec, accessibility
- [`../docs/SwipeHire-DEMO-Journey-Map.md`](../docs/SwipeHire-DEMO-Journey-Map.md) — the user-journey
  diagram mapped onto demo scope
- [`../docs/handoff/Ticket-List.md`](../docs/handoff/Ticket-List.md) — build plan and status

## Rules that bite most often on this side

- **No hard-coded hex or px values in components.** Everything comes from `theme/tokens.ts`, copied
  verbatim from the full Frontend Spec §15 and catalogued in `../docs/handoff/Frontend.md` §2. Do not retype a hex code from memory.
- **Anti-"dating app" visual direction.** No hearts, no flames/streaks, no hot pink or red as a
  primary, no confetti, no bouncy spring overshoot, no photo-first candidate browsing.
- **Three type roles, never mixed:** Fraunces (display), Inter (UI/body), IBM Plex Mono (any number
  that states a fact — salary, match %, years, timestamps).
- **`MatchSeal` and `SwipeCard` get built first and get built right.** `handoff/Frontend.md` §3 and §4 are explicit
  about this: whether the demo "feels real" rides on those two components.
- **Keep the 3-card rolling window** on the deck. It is the cheap thing that makes swiping feel
  smooth, and the demo doc calls it out as do-not-cut.
- **Blind-first candidate cards:** initials avatar, first name + last initial pre-match. This is an
  anti-bias product decision, not a placeholder to fill in with real photos later.

## Navigation

React Navigation, matching the tree in `../docs/handoff/Frontend.md` §5 one-to-one (`RootStack` →
`OnboardingStack` / `CandidateRootTabs` / `RecruiterRootTabs`). Not Expo Router — the spec's tree is
written in React Navigation terms and translating it would only add drift.
