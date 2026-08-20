# SwipeHire — Frontend Specification

The mobile app as built. Design system, navigation, components and the rules that govern them.
Companion documents: `Backend.md` for the API this consumes, `Architecture.md` for the system around
it.

---

## 1. Visual direction

The single governing constraint, and the one most easily violated by accident:

> **This must not look like a dating app.**

No heart icons. No flames or streaks. No hot pink or red as a primary colour. No confetti. No bouncy
spring overshoot. No photo-first candidate browsing.

The product is a hiring instrument, and the visual language is instrumentation: a calibration dial
rather than a progress bar, measured motion rather than playful motion, typography that separates
facts from prose. If an implementation detail would introduce any of the above, it is a spec
violation even if it looks nice in isolation.

## 2. Design tokens

Live in `src/theme/tokens.ts`, copied verbatim from the full specification. **No component may
contain a raw hex or px value** — everything references the token object.

### Colour

| Token | Value | Use |
|---|---|---|
| `primary` | `#3B4FE0` | Primary actions, the low end of the Match Seal arc |
| `primaryPressed` | `#2A3AB0` | Pressed state |
| `primaryTint` | `#EEF0FD` | Selected backgrounds, chip fills |
| `secondary` | `#D6A24C` | Gold. The high end of the Match Seal arc |
| `secondaryTint` | `#FBF1DF` | |
| `background` | `#F7F5F1` | Warm off-white, not pure grey |
| `backgroundChrome` | `#0F1629` | Dark chrome surfaces |
| `surface` / `surfaceAlt` | `#FFFFFF` / `#FCFBF9` | Cards |
| `border` / `borderStrong` | `#E4E1DA` / `#CBC7BD` | |
| `textPrimary` / `textSecondary` | `#14171F` / `#5B6472` | |
| `success` / `warning` / `error` | `#1F9D6F` / `#C97A2E` / `#D0453B` | Each with a `*Tint` |
| `swipeRight` / `swipeLeft` | `#1F9D6F` / `#5B6472` | Stamp colours |
| `swipeFastTrack` | `#D6A24C` | Ships in the token block; the gesture is out of scope |

> **`#D6A24C` gold is never used for text.** Fills and borders only — it fails WCAG AA at body size.

### Type — three roles, never mixed

| Role | Family | Used for |
|---|---|---|
| Display | **Fraunces** 600 | `displayXl` 40, `displayL` 32, `h1` 28, `h2` 22 |
| UI / body | **Inter** 400/500/600 | `h3` 18, `bodyL` 16, `bodyM` 14, `caption` 12, `button` 15 |
| Data | **IBM Plex Mono** 400/500 | `dataL` 20, `dataS` 13 |

**Every number that states a fact is mono** — salary, match percentage, years of experience,
timestamps. Never set one in Inter because it is convenient in a given layout.

Two implementation details that are easy to get wrong and are handled in `theme/typography.ts`:

- React Native picks a custom face by **name**, not family + weight. Setting `fontWeight` next to a
  custom `fontFamily` makes the OS synthesise a fake bold over an already-bold face, so the weight
  is folded into the family name and `fontWeight` is never emitted.
- Mono tokens carry `fontVariant: ['tabular-nums']`. Without it, a score ticking 78 → 81 reflows the
  layout, which reads as sloppy on a card meant to feel like an instrument reading.

### Spacing, radius, motion

`spacing` 4 / 8 / 12 / 16 / 24 / 32 / 48 · `radius` 8 / 12 / 16 / pill ·
`motion.duration` fast 150, base 250, slow 400, sealSweep 900 · `motion.spring` damping 18,
stiffness 180.

## 3. The Match Seal

The signature element. A circular calibration dial: 24 tick marks form a gauge bezel, and an
indigo→gold arc fills clockwise from twelve o'clock in proportion to the score. Three sizes — 32,
56, 96px. Built once in `components/swipe/MatchSeal.tsx` and reused everywhere a score appears,
never reimplemented per screen.

Two decisions inside it are load-bearing:

**The gradient runs along the arc, not across the box.** Colour is tied to meaning — indigo is low
confidence, gold is high — so a 40% seal must read as clearly cooler than a 92% one. A plain SVG
linear gradient varies by position rather than angle, which leaves every score looking much the same
and reduces the seal to an arc-length readout. The ring is therefore drawn as 72 discrete segments
whose colour is interpolated by angle, revealed by an animated mask.

**Motion is `withTiming` with an ease-out cubic, never a spring.** A spring overshoot on a
*measurement* reads as imprecise, which undercuts the entire metaphor.

## 4. The swipe deck

The other thing not to compromise on. Everything in `hooks/useSwipeGesture.ts` runs on the UI thread
as worklets — a drag never round-trips through JS. Only the committed-swipe callback crosses back
via `runOnJS`.

| Property | Value |
|---|---|
| Commit threshold | 28% of screen width, **or** a fling faster than 800 px/s |
| Max tilt | 8° |
| Exit | 400ms, ease-out quad, flies to 1.2× screen width |
| Snap-back | Spring, damping 15 / stiffness 150 |
| Card promotion | Spring, damping 18 / stiffness 180 (the token value) |
| Rolling window | 3 cards, resting scales 1 / 0.96 / 0.92, offsets 0 / 8 / 16px |

The card pivots from the bottom corner **opposite** the drag, so it flicks off a table rather than
spinning in place. React Native rotates about the view centre, so the pivot is moved by translating
out, rotating, and translating back.

Stamps — SHORTLIST and PASS — fade in proportionally to drag distance, reaching full opacity exactly
at the commit threshold, so the card tells you what will happen before you release it.

Two spec conflicts were resolved deliberately and are recorded in the source: snap-back uses the
more specific 15/150 rather than the token block's 18/180, and stacked cards rest at 0.96/0.92 with
a promoting card animating 0.96 → 1.0.

**Left and right only.** The drag-up Fast-Track gesture is out of scope, so there is no
up-threshold and no third stamp.

## 5. Navigation

Decided by state, not by navigation calls. `RootNavigator` reads the session and the profile and
renders the right tree; nothing anywhere navigates "to the app" after login or "to login" after
logout. A token expiring mid-session drops the user back to auth without any screen handling it.

```
RootNavigator
├── no session ────────► OnboardingNavigator
│                          Splash · RoleSelect · Auth
├── setup incomplete ──► SetupNavigator
│                          candidate: Basics → Resume → ReviewSkills → Preferences
│                          recruiter: RecruiterSetup
├── candidate ─────────► CandidateNavigator (tabs)
│                          Discover  : SwipeDeck → JobDetails
│                          Matches   : MatchesList → Chat        [unread badge]
│                          Profile   : Profile → ResumeUpdate → ResumeSkills
└── recruiter ─────────► RecruiterNavigator (tabs)
                           Listings  : Dashboard → CandidateDeck
                           Matches   : MatchesList → Chat        [unread badge]
                           Company   : Profile
```

"Setup complete" is derived from the profile rather than stored as a flag, so it cannot drift out of
step with what is actually filled in: a candidate needs a name and at least one skill (an empty
skill list would make every match score zero and the deck meaningless); a recruiter needs a name and
a company.

Each tab holds its own stack, so a pushed screen keeps its tab bar and its own back history — which
is what makes tabbing away from a chat and back feel like returning rather than reloading.

**The recruiter lands on the dashboard, not a deck.** A recruiter's deck only means anything
relative to a listing, so choosing the listing is the first act. The empty state covers first-run.

## 6. Screens

| Screen | Notes |
|---|---|
| Splash | Shown while the stored session is verified against `/auth/me` |
| RoleSelect | Precedes the signup form; the role travels in the signup request and is fixed server-side |
| Auth | Email + password, sign in / sign up |
| CandidateBasics | Name, title, headline, years |
| ResumeUpload | PDF picker → signed-URL upload → parsing spinner. Skippable |
| ReviewSkills | Parsed skills as removable chips, plus manual entry. **The honest moment** — a real parser ran and the user corrects it |
| Preferences | Salary range, work mode, notice period |
| RecruiterSetup | Company name, industry |
| SwipeDeck (candidate) | Job cards, scored and sorted |
| JobDetails | Full description, pushed from a card tap |
| JobsDashboard | Listings with per-listing counts; entry point to each deck |
| JobCreate | Title, description, tech stack, comp, location, work mode, min years |
| CandidateDeck | Blind-first candidate cards for one listing |
| MatchesList | Both roles. Seal, last message, unread badge, status |
| Chat | Messages, interview slot cards, outcome sheet |
| MatchCelebration | The "It's a Match!" moment, with the seal sweeping in |
| Profile / Company | Read-only summary, resume management, logout |

The candidate Profile also renders a **"How recruiters see you"** preview using the real card
component rather than a mock-up — so the blind-first rule is something the user can see rather than
be told. Their own surname is missing from their own preview, because it is missing from the payload
a recruiter receives.

## 7. Components

`SwipeCard` · `SwipeDeck` · `SwipeStamp` · `MatchSeal` · `JobCardContent` · `CandidateCardContent` ·
`ChatBubble` · `InterviewSlotCard` · `ProposeInterviewSheet` · `MatchOutcomeSheet` · `Button` ·
`Input` · `SkillChip` · `EmptyState` · `ErrorState` · `LoadingState`.

Recruiter-facing candidate cards are **not photo-first**: an initials avatar, first name and last
initial only. That is an anti-bias product decision, not a placeholder to fill in with real photos
later.

No FlashList. Cell recycling earns its dependency over hundreds of rows; a match list is a handful.

The tab bar is typographic rather than iconographic — an icon set was not installed, and
substituting an emoji-style set was ruled out, so it ships with labels instead of the wrong icons.

## 8. Data layer

**TanStack Query** for server state, **Zustand** for the session only.

`services/api/client.ts` is the single HTTP client. Beyond fetch it does two things: attaches the
access token, and transparently recovers from a `401` by refreshing **once**. Access tokens last
fifteen minutes, so most sessions outlive one. A second failure means the session is genuinely over,
and looping would only delay saying so.

Two error types are distinguished because they need different copy: `ApiError` (the server said no)
and `NetworkError` (the device could not reach it at all). A network blip must never log a user out
— losing signal in a lift would end a demo.

Tokens live in **SecureStore** — Keychain on iOS, encrypted prefs on Android — not AsyncStorage. A
refresh token is a thirty-day session; leaving it in plain app storage hands it to a rooted device
for free.

The client and the store are wired by injection rather than import, because the store imports the
client to call `/auth/refresh`, and importing back would be a cycle.

### Socket

One module-level Socket.io singleton, connected at the navigation root and kept alive across
screens. A match arriving while the user is deep in the recruiter dashboard still needs to land, so
tearing the socket down on navigation would drop exactly the events the product depends on. It is
**delivery only** — every write goes over REST.

## 9. States

Every list and every screen that fetches has three states built, not deferred: skeleton while
loading, a written empty state, and an error state with a retry. Empty-state copy is specific — an
exhausted deck offers a way back rather than a dead end.

## 10. Accessibility

Launch requirements, not a follow-up pass.

- **The gesture is never the only path.** Every `SwipeCard` carries Pass and Shortlist buttons that
  run the same commit animation. A screen-reader user is never asked to perform a drag.
- **Only the front card is reachable by a screen reader.** The two stacked behind it are
  `accessibilityElementsHidden` with `importantForAccessibility="no-hide-descendants"` — decoration
  until promoted.
- Cards expose a composed `accessibilityLabel` describing the whole card, with a hint for the
  details tap. Action buttons carry hints stating the consequence — "Skips this job. It won't be
  shown again."
- 44×44pt minimum touch targets.
- WCAG AA contrast; gold never used for text.
