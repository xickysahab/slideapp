# SwipeHire — Frontend Specification Document
**React Native (iOS + Android) · v1.0 · Design & Frontend Architecture Reference**

This document is the single source of truth for how SwipeHire looks, feels, and behaves on the frontend. It is written to be implementable directly — by a developer or an AI coding tool — without further design decisions.

---

## 0. Design Philosophy (read this first)

SwipeHire borrows the *gesture* of a swipe app but rejects its *visual grammar*. Hearts, flame streaks, neon pink, and confetti read as "casual dating app" — the opposite of what a recruiter evaluating candidates, or a candidate evaluating their next job, wants to feel.

The reference point instead is the **verified professional dossier**: a candidate profile or job listing should feel like a clean, credentialed document that has been checked and stamped — not a photo you're rating. Two ideas run through every screen:

1. **Paper, not neon.** Surfaces read like clean stock paper (`#F7F5F1`) with hairline borders instead of heavy drop shadows — closer to a well-typeset document than a floating card game.
2. **The Match Seal.** Every card carries a circular, gauge-like match indicator — ticked like a calibration dial, filled with an indigo-to-gold arc — instead of a plain percentage badge. It's SwipeHire's one recurring signature element, used consistently across job cards, candidate cards, the match screen, and chat headers, so it becomes instantly recognizable as "the SwipeHire mark of relevance."

Three type roles reinforce this: a serif for headline moments (institutional trust), a grotesk for UI and body copy (speed and clarity), and a monospace for every number that matters — salary, match %, experience, timestamps (precision, like a data terminal). Full definitions below.

**Avoid:** heart icons, flame/streak icons, hot pink/red as primary color, bouncy spring overshoot on every interaction, photo-first candidate browsing, celebratory confetti/emoji bursts.
**Lean into:** navy + indigo + warm paper + a single gold accent, generous whitespace, hairline dividers, mono numerals, calm and deliberate motion.

---

## 1. Design Direction

| Attribute | Direction |
|---|---|
| Personality | Confident, precise, quietly premium — a fintech/compliance feel applied to hiring |
| Tone of voice (UI copy) | Plain, active, specific. "Send interview slots," not "Submit." No exclamation marks, no forced enthusiasm |
| Motion | Deliberate and physics-based (Reanimated spring with high damping — no overshoot bounce), never decorative |
| Density | Medium — enough whitespace to feel calm, enough data on-screen to feel efficient |
| Corner radius | Moderate (12–16px) — soft enough to feel humane, sharp enough to feel serious. Never fully rounded/pill on cards |
| Elevation | Hairline borders + a single soft ambient shadow. No layered "floating card stack" shadows |
| Imagery | Candidates: no profile photo in the primary card (see §6). Jobs: company logo only, never stock photography |
| Iconography | [Phosphor Icons](https://phosphoricons.com) — "duotone" weight for primary actions, "regular" for utility. Outline-first, never filled emoji-style icons |

---

## 2. Color Palette

Light mode is the default and primary experience (recruiter and candidate flows both). A dark-mode mapping is included for the OS-level toggle.

### 2.1 Core palette

| Token | Hex | Usage |
|---|---|---|
| `color.primary` | `#3B4FE0` | Primary buttons, active tab, links, focus rings, right-swipe affordance |
| `color.primary.pressed` | `#2A3AB0` | Pressed/active state of primary |
| `color.primary.tint` | `#EEF0FD` | Selected chip fill, info banners, primary-tinted backgrounds |
| `color.secondary` (Verified Gold) | `#D6A24C` | Match Seal fill, Fast-Track badge, premium/verified markers — used sparingly |
| `color.secondary.tint` | `#FBF1DF` | Gold badge backgrounds |
| `color.background` | `#F7F5F1` | App canvas (warm paper, not clinical white) |
| `color.background.chrome` | `#0F1629` | Top bar / bottom tab bar / bottom-sheet header — ink navy, role-distinguishing chrome |
| `color.surface` | `#FFFFFF` | Cards, sheets, modals |
| `color.surface.alt` | `#FCFBF9` | Input fields, secondary surfaces, list row backgrounds |
| `color.border` | `#E4E1DA` | Hairline dividers, card borders, input borders |
| `color.border.strong` | `#CBC7BD` | Focused input border, emphasized dividers |
| `color.text.primary` | `#14171F` | Headlines, primary body text |
| `color.text.secondary` | `#5B6472` | Muted/secondary text, captions, placeholders |
| `color.text.inverse` | `#F7F5F1` | Text on navy/indigo surfaces |
| `color.success` | `#1F9D6F` | Match confirmed, hired, verified badge |
| `color.success.tint` | `#E4F5EC` | Success banners |
| `color.warning` | `#C97A2E` | Pending review, awaiting response, resume-processing |
| `color.warning.tint` | `#FBEDDD` | Warning banners |
| `color.error` | `#D0453B` | Failed states, destructive actions, validation errors |
| `color.error.tint` | `#FBE7E5` | Error banners |

### 2.2 Match Seal gradient

The Match Seal ring is never a flat fill — it's an arc gradient from `#3B4FE0` (indigo, low confidence) to `#D6A24C` (gold, high confidence), always drawn clockwise from 12 o'clock. Ring track (the unfilled remainder) is `#E4E1DA`.

### 2.3 Swipe-direction accent (used only as a transient overlay on the card during drag, never as static UI chrome)

| Token | Hex | Usage |
|---|---|---|
| `color.swipe.right` | `#1F9D6F` | "PASS TO / SHORTLIST" stamp overlay on right-drag (green, not pink) |
| `color.swipe.left` | `#5B6472` | "SKIP" stamp overlay on left-drag (neutral slate, not red — a skip isn't a failure) |
| `color.swipe.fasttrack` | `#D6A24C` | "FAST-TRACK" stamp overlay on the dedicated fast-track gesture |

### 2.4 Dark mode mapping

| Token | Light | Dark |
|---|---|---|
| `background` | `#F7F5F1` | `#0B0F1A` |
| `surface` | `#FFFFFF` | `#161B2B` |
| `surface.alt` | `#FCFBF9` | `#1D2338` |
| `border` | `#E4E1DA` | `#2A3149` |
| `text.primary` | `#14171F` | `#F1F2F6` |
| `text.secondary` | `#5B6472` | `#8B93A7` |
| `primary` | `#3B4FE0` | `#6C7BFF` |
| `secondary` (gold) | `#D6A24C` | `#E8BC72` |


---

## 3. Typography

Three type roles, never mixed outside their role:

| Role | Family | Why |
|---|---|---|
| **Display / Headline** | [Fraunces](https://fonts.google.com/specimen/Fraunces) (variable, `opsz` 9–72, weights 400/500/600/900) | A soft-serif with editorial weight — carries institutional trust on onboarding, empty states, and the match-celebration screen |
| **UI / Body** | [Inter](https://fonts.google.com/specimen/Inter) (weights 400/500/600/700) | Neutral, extremely legible at small sizes, full Latin + Devanagari fallback coverage for the India user base |
| **Data / Mono** | [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (weights 400/500) | Every number that represents a fact — salary, match %, years of experience, timestamps — is set in mono, tabular-figures on, so numbers feel measured rather than decorative |

### 3.1 Type scale

| Token | Family | Size / Line-height | Weight | Usage |
|---|---|---|---|---|
| `type.display.xl` | Fraunces | 40 / 48 | 600 | Splash, match-celebration hero |
| `type.display.l` | Fraunces | 32 / 40 | 600 | Onboarding headlines |
| `type.h1` | Fraunces | 28 / 34 | 600 | Screen titles |
| `type.h2` | Fraunces | 22 / 28 | 600 | Section headers ("About the role," "Skills") |
| `type.h3` | Inter | 18 / 24 | 600 | Card titles (job title, candidate name), sheet headers |
| `type.body.l` | Inter | 16 / 24 | 400 | Primary body copy, descriptions |
| `type.body.m` | Inter | 14 / 20 | 400 | Secondary copy, list rows |
| `type.caption` | Inter | 12 / 16 | 500 | Timestamps' labels, helper text, badge labels |
| `type.button` | Inter | 15 / 20 | 600, +0.2px tracking | All button labels |
| `type.data.l` | IBM Plex Mono | 20 / 24 | 500, tabular-nums | Salary hero figure, match % inside the Seal |
| `type.data.s` | IBM Plex Mono | 13 / 18 | 400, tabular-nums | Timestamps, "3 yrs exp," job-recency ("2d ago") |

### 3.2 Rules

- Never set Fraunces below 18px — its ink-traps and serif detail disappear and it just reads as a slow-loading body font.
- Body copy max width: 34em (`~560px` at 16px base) even on tablet, for readability.
- Dynamic Type / font scaling (§12) scales `body`, `caption`, and `h1–h3` tokens; `type.data.*` scales at 80% of the system multiplier so dense numeric layouts (candidate card stat rows) don't break.

---

## 4. Component System

All components live in `src/components/` (see §14) as function components with a typed props interface, styled via the design tokens in §15 — never hard-coded hex/px values inside a component.

### 4.1 Component inventory

| Component | Variants | Notes |
|---|---|---|
| `Button` | `primary`, `secondary`, `ghost`, `destructive`; sizes `sm`/`md`/`lg` | 48px min height (`md`), full-width or auto, loading state replaces label with spinner, disabled = 40% opacity |
| `Input` | `text`, `multiline`, `select`, `otp` | Floating label, error state shows `color.error` border + helper text below |
| `Card` | `elevated` (shadow), `outlined` (hairline border, default) | Base wrapper other cards compose from |
| `SkillChip` | `default`, `matched` (indigo tint, used when the skill overlaps the other side's requirement), `selected` (filter context) | Pill shape is the one deliberate exception to the "no full pill" rule — chips are meant to read as tags, not buttons |
| `MatchSeal` | sizes `sm` (32px, list rows), `md` (56px, card corner), `lg` (96px, match-celebration screen) | See §4.3 for full spec — the signature component |
| `SwipeCard` | `job`, `candidate` | See §5 and §6 |
| `BottomSheet` | `fixed` (fixed height), `snap` (50%/90% snap points) | Navy header bar (`color.background.chrome`), drag handle, backdrop dismiss |
| `Modal` | `alert` (title + body + 1–2 actions), `fullscreen` (used for resume review, interview-slot picker) | Alert modal max-width 320px, centered |
| `TabBar` | bottom tab bar, 3–4 items | Navy chrome background, active icon+label in `primary` on `text.inverse`, inactive at 55% opacity |
| `SegmentedControl` | 2–4 segments | Used for Job Seeker/Recruiter role toggle at signup, filter category switches |
| `FilterSheet` | — | `BottomSheet` (`snap`) composed with `SkillChip`, `RangeSlider`, and a sticky "Apply (N)" footer button |
| `ProfileSection` | `header`, `stat-row`, `skill-block`, `experience-item`, `resume-preview` | Composed building blocks for both candidate and recruiter profile screens |
| `JobSection` | `header`, `requirements`, `benefits`, `company-block` | Same pattern for job-details screen |
| `ChatBubble` | `sent`, `received`, `system` (e.g. "Interview slot proposed") | `sent` uses `primary` fill / `text.inverse`; `received` uses `surface.alt`; `system` is a centered pill in `color.text.secondary` |
| `NotificationToast` | `success`, `info`, `error` | Slides from top, auto-dismiss 3s, swipe-up to dismiss early |
| `EmptyState` | icon/illustration + `h2` + `body.m` + optional CTA button | See §13 |
| `LoadingState` | `skeleton` (card-shaped shimmer, default for deck/list loads), `spinner` (inline, buttons/small regions), `progress` (resume parsing, determinate) | Skeletons use `surface.alt` base with a 1200ms shimmer sweep |
| `ErrorState` | inline banner or fullscreen, always icon + message + "Retry" | See §13 |

### 4.2 `Button` — reference props

```tsx
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'; // default 'primary'
  size?: 'sm' | 'md' | 'lg'; // default 'md'
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: PhosphorIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}
```

### 4.3 `MatchSeal` — the signature component

A circular calibration-dial indicator, not a generic progress ring: 24 tick marks around the circumference (like a gauge), an arc fill from `color.primary` → `color.secondary` (see §2.2) proportional to `matchPercent`, and the number set in `type.data.l`/`type.data.s` (mono, size-dependent) centered inside.

```tsx
interface MatchSealProps {
  matchPercent: number;       // 0–100
  size?: 'sm' | 'md' | 'lg';  // 32 / 56 / 96 px — default 'md'
  animateIn?: boolean;        // sweep the arc from 0 -> matchPercent on mount (used on card entry + match screen)
}
```

Animation: on mount, if `animateIn`, the arc sweeps over 900ms with an `Easing.out(Easing.cubic)` curve using Reanimated's `useAnimatedProps` on the SVG `Circle` `strokeDashoffset` — never a spring (a spring overshoot on a "measurement" reads as imprecise, which undercuts the whole metaphor).

---

## 5. Candidate-Facing Swipe Card (Job Card)

**Layout, top to bottom (16px card padding, 8px internal gutter):**

```
┌───────────────────────────────────────┐
│  [Company Logo 40×40]     [MatchSeal ●76%] │  ← row 1: logo left, seal top-right
│  Senior Backend Engineer               │  ← h3, text.primary
│  Razorpay · Bengaluru                  │  ← body.m, text.secondary (company · location)
│                                         │
│  ₹18L–₹28L /yr   ·   Remote            │  ← type.data.l for salary, body.m for work-mode chip
│  3–5 yrs exp   ·   Posted 2d ago       │  ← type.data.s, text.secondary
│                                         │
│  Node.js  TypeScript  AWS  +3          │  ← SkillChip row, matched chips in primary tint
│                                         │
│  "Own the payments infra team's core   │  ← body.m, 2-line clamp, text.primary
│   ledger service, processing 40M..."   │
│                                         │
│  [ Pass ]        [ Fast-Track ]  [ Shortlist ] │  ← button row, see §7 for gesture equivalents
└───────────────────────────────────────┘
```

| Field | Source | Notes |
|---|---|---|
| Company logo | `job.company.logoUrl` | 40×40, `radius.sm`, fallback: first letter monogram on `primary.tint` |
| Match % | `MatchSeal` `md`, top-right | Computed server-side from resume-vector ↔ job-vector cosine similarity (see §11 Matching) |
| Job title | `type.h3` | 1-line, ellipsis |
| Company · Location | `type.body.m`, `text.secondary` | |
| Salary | `type.data.l` | Always shown as a range; "Not disclosed" in `text.secondary` if absent — never hidden entirely |
| Work mode | Chip: `Remote` / `Hybrid` / `On-site` | `secondary.tint` background, `text.primary` |
| Experience required | `type.data.s` | e.g. "3–5 yrs exp" |
| Recency | `type.data.s`, `text.secondary` | Relative ("2d ago"), absolute on long-press |
| Skills | `SkillChip` row, max 4 visible + "+N" overflow chip | Chips matching the candidate's resume-extracted skills render in `matched` variant |
| Description | `body.m`, 2-line clamp with fade-out mask | Full text on tap → Job Details screen |
| Action row | `Pass` (ghost), `Fast-Track` (secondary/gold outline), `Shortlist` (primary) | Mirrors the gestures in §7 for accessibility / non-gesture use |

Card dimensions: width = `screenWidth - 32` (16px side margin), height = auto up to a max of `screenHeight * 0.72` so the action row is always visible above the tab bar without scrolling.

---

## 6. Recruiter-Facing Swipe Card (Candidate Card)

Deliberately **not photo-first** — the primary card leads with role and signal, not a headshot, to reduce bias in the swipe-speed browsing pattern. A small circular avatar (initials-based by default) sits inline with the name, not as a hero image.

```
┌───────────────────────────────────────┐
│  (AK)  Aditi K.            [MatchSeal ●82%] │  ← 32px initials avatar + name, seal top-right
│  Senior Backend Engineer               │  ← current/target role, h3
│  5 yrs exp   ·   Bengaluru (Remote-OK) │  ← type.data.s
│                                         │
│  Node.js  Postgres  AWS  System Design │  ← SkillChip row, matched chips highlighted
│                                         │
│  ★ Led migration cutting infra cost 30%│  ← key-achievement line, body.m, single line
│                                         │
│  📄 Resume available    🔗 GitHub      │  ← resume + portfolio affordance row, tap opens preview
│                                         │
│  [ Pass ]        [ Fast-Track ]  [ Shortlist ] │
└───────────────────────────────────────┘
```

| Field | Source | Notes |
|---|---|---|
| Avatar | Initials monogram on `primary.tint`, OR uploaded photo **only if the candidate opted in** via a profile setting (default off) | See product note below |
| Name | First name + last initial by default (full name revealed post-match) | Reduces premature identification bias pre-match |
| Primary role | `type.h3` | Candidate's stated target role, not just current title |
| Experience · Location | `type.data.s` | |
| Skills | `SkillChip`, matched-against-job-requirement chips in `matched` variant | Ranked so matched skills always appear first |
| Key achievement | `type.body.m`, single line, resume-parser-extracted or self-authored | Recruiters scan this first after match % |
| Resume / portfolio | Icon-row affordances — resume opens `Modal (fullscreen)` preview; GitHub/portfolio links open in-app browser | Never auto-downloads |
| Action row | Same three actions as job card | |

**Product note:** hiding full name and photo behind the match is a deliberate anti-bias default in line with the "trust dossier, not dating profile" direction — flag this to product/legal as a configurable policy, not a hard requirement, since some recruiter workflows may require photo ID pre-match.

---

## 7. Swipe Interaction

Built on **React Native Gesture Handler** (`PanGestureHandler` / `Gesture.Pan()` in the new Gesture API) driving **React Native Reanimated 3** shared values — all interaction runs on the UI thread, no bridge round-trips per frame.

### 7.1 Gesture mapping

| Gesture | Action | Threshold |
|---|---|---|
| Drag left | Skip (candidate: not interested; recruiter: pass) | Release past `-0.28 * screenWidth` OR velocity < `-800px/s` |
| Drag right | Shortlist / interested | Release past `0.28 * screenWidth` OR velocity > `800px/s` |
| Drag up | Fast-Track (signals high priority to the other side; consumes a limited daily quota, shown in a counter badge) | Release past `-0.22 * screenHeight` OR velocity < `-900px/s` |
| Tap card | Open full detail screen (Job Details / Candidate Details) | — |
| Tap MatchSeal | Opens a small popover breaking down the match score (skills overlap, experience fit, location fit — 3 sub-bars) | — |
| Long-press card | Preview mode — holds card at 92% scale, dims background, releases back to deck on lift | — |

### 7.2 Motion spec

- **Follow phase:** card `translateX`/`translateY` = 1:1 with finger via `useAnimatedGestureHandler`; `rotate` interpolates from `-8deg` to `8deg` across `[-screenWidth/2, screenWidth/2]` (rotation pivots from the bottom corner opposite the drag direction, like a card being flicked off a table, not spinning in place).
- **Overlay stamps:** `PASS` / `SHORTLIST` / `FAST-TRACK` labels fade in via `opacity = interpolate(translateX, [0, threshold], [0, 1])`, angled -12°, colors per §2.3.
- **Release — committed swipe:** `withTiming` to fully off-screen (400ms, `Easing.out(Easing.quad)`), then the card is unmounted and the next card in the rolling window (§8) promotes forward with a `withSpring` (damping 18, no overshoot) scale-up from 0.94 → 1.0.
- **Release — undo (below threshold):** `withSpring` back to `{x:0, y:0, rotate:0}` (damping 15, stiffness 150).
- **Undo action (explicit button, not gesture):** available for 5 seconds after a committed swipe via a bottom toast ("Undo") — pops the last swiped item back onto the deck with a reverse of the exit animation. Backed by a small in-memory stack (last 3 actions), not just a visual trick — the backend swipe record is also rolled back.
- **Match animation:** on mutual right-swipe, the current card doesn't just disappear — it freezes, a `MatchSeal (lg)` sweeps in from 0% behind a brief scrim, and the screen transitions to the full Match screen (§9). No confetti; the gold arc sweep IS the celebration.

### 7.3 Core gesture handler (reference implementation)

```tsx
const translateX = useSharedValue(0);
const translateY = useSharedValue(0);

const panGesture = Gesture.Pan()
  .onUpdate((e) => {
    translateX.value = e.translationX;
    translateY.value = e.translationY;
  })
  .onEnd((e) => {
    const passedRightThreshold = e.translationX > SWIPE_THRESHOLD_X || e.velocityX > VELOCITY_THRESHOLD;
    const passedLeftThreshold = e.translationX < -SWIPE_THRESHOLD_X || e.velocityX < -VELOCITY_THRESHOLD;
    const passedUpThreshold = e.translationY < -SWIPE_THRESHOLD_Y || e.velocityY < -VELOCITY_THRESHOLD;

    if (passedUpThreshold) {
      runOnJS(onFastTrack)(cardId);
      translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 350 });
    } else if (passedRightThreshold) {
      runOnJS(onSwipeRight)(cardId);
      translateX.value = withTiming(SCREEN_WIDTH * 1.2, { duration: 400 });
    } else if (passedLeftThreshold) {
      runOnJS(onSwipeLeft)(cardId);
      translateX.value = withTiming(-SCREEN_WIDTH * 1.2, { duration: 400 });
    } else {
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
    }
  });
```

`onSwipeLeft`/`onSwipeRight`/`onFastTrack` are `runOnJS`-bridged callbacks that (a) optimistically update local state/queue and (b) fire the swipe-record network call — see §8.6 and §11.

---

## 8. Performance (60fps target)

| Concern | Rule |
|---|---|
| Mounted cards | Rolling window of **3** (`current`, `next`, `next+1`) — everything else stays in the paginated data cache, unmounted. `next` and `next+1` are rendered at `scale: 0.96/0.92` and slightly translated behind `current`, pre-laid-out so the promotion animation (§7.2) has no layout jump |
| Prefetching | When `current` index reaches position N, fetch the next page (20 items) if fewer than 5 remain in the local queue. Images for `next` and `next+1` are prefetched via `Image.prefetch` (or `expo-image`'s disk-cache) as soon as they enter the window, never earlier |
| Image caching | Company logos / avatars use `expo-image` with `cachePolicy="disk"` and a fixed `contentFit` box — never re-decode on re-render |
| Memoization | Card components wrapped in `React.memo` with a custom comparator on `id` + `matchPercent` only; gesture handler callbacks are `useCallback`'d and stable across re-renders (deck re-render must not re-create the `Gesture.Pan()` instance) |
| Optimistic updates | Every swipe writes to local state / SQLite (via WatermelonDB or simple MMKV queue) **before** the network call resolves; a background sync worker flushes the swipe queue to the API in batches (see §11) and reconciles on failure (surfaces a non-blocking retry toast, never blocks the deck) |
| Pagination | Cursor-based, 20 items/page, `?cursor=<id>&limit=20` — see §11 |
| Network behavior | Swipe writes are batched every 2s or every 5 actions (whichever first) via a debounced queue flush — not one request per swipe, to avoid request storms on fast swiping |
| Memory management | `FlashList` (not `FlatList`) is used for every non-deck list (matches, chat, candidate/job list views) for cell recycling; the swipe deck itself is NOT a list component — it's the custom 3-card rolling window above, since list virtualization fights with free-drag gestures |
| List rendering | All list screens (`Matches`, `Chat` history, `Job Management`) use `FlashList` with `estimatedItemSize` set and `getItemType` for mixed row types (e.g. chat text vs. system messages) |

---

## 9. Screen-by-Screen Specification

Grounded in the approved SwipeHire user-journey flow (App Launch → role selection → auth → role-specific onboarding → swipe deck → match → chat → interview scheduling → outcome).

### 9.1 Candidate flow

| # | Screen | Purpose & key elements |
|---|---|---|
| 1 | **Splash** | `type.display.xl` wordmark on `background.chrome` (navy), MatchSeal mark animates a single quick arc-sweep as the loading indicator. ≤1.5s or transitions on auth-check resolve |
| 2 | **Onboarding (3 slides)** | Fraunces headline + illustration per slide: "Swipe into the right role," "Let AI parse your resume in seconds," "Match, chat, and schedule — no cold emails." Skip button top-right |
| 3 | **Role Selection** | `SegmentedControl`-style large tap targets: "I'm looking for a job" / "I'm hiring" — this choice sets the entire app's navigation stack (§10) |
| 4 | **Sign Up / Login** | Phone-number-first (India-primary) with OTP, plus Google/LinkedIn OAuth. Biometric (Face ID/fingerprint) offered as a follow-up prompt for returning sessions, not first login |
| 5 | **Profile Setup — Basic Info** | Name, target role, location, notice period. Progress indicator (step 1 of 4) |
| 6 | **Resume Upload** | Drag-in/file-picker card, accepts PDF/DOCX, upload progress bar (`LoadingState — progress`) |
| 7 | **Resume Parsing Status** | Full-screen `LoadingState — progress` with staged copy: "Reading document" → "Extracting skills" → "Matching to roles" (mirrors real backend NLP pipeline stages, never a fake generic spinner) |
| 8 | **Review & Edit Auto-Filled Profile** | Editable form pre-filled from the parser: skills (`SkillChip`, removable/addable), experience timeline, education. A "Confidence" microcopy note on any low-confidence extracted field, prompting a quick check |
| 9 | **Preferences** | Location(s), salary band (dual slider), remote/hybrid/on-site (`SegmentedControl`, multi-select), notice period — this is what the match vector is partly built from |
| 10 | **Job Discovery / Swipe Deck** | The core screen — see §5/§7. Top bar: filter icon (opens Filter Sheet) + saved-searches icon |
| 11 | **Job Details** | Full `JobSection` breakdown: description, requirements, benefits, company block, `MatchSeal (lg)` with tap-to-expand breakdown. Sticky bottom action row |
| 12 | **Filters** | `FilterSheet` — role, salary range, location, remote/hybrid/on-site, company size, posted-within |
| 13 | **Matches (list)** | `FlashList` of match rows: avatar/logo, name/title, `MatchSeal (sm)`, last-message preview, unread dot |
| 14 | **Chat** | `ChatBubble` list + composer. System messages for interview-slot proposals render as an inline `InterviewSlotCard` (accept/decline buttons) rather than plain text |
| 15 | **Interview Scheduling** | Full-screen `Modal`: proposed slots list → tap to confirm → calendar-sync confirmation state |
| 16 | **Profile / Settings** | Own profile preview (as recruiters see it), notification prefs, privacy (photo visibility toggle — see §6 product note), account, logout |

### 9.2 Recruiter flow

| # | Screen | Purpose & key elements |
|---|---|---|
| 1 | **Onboarding** | Same shell as candidate onboarding, recruiter-angled copy: "Swipe into your next hire," "Post a role in minutes," "Chat and schedule the moment it's a match" |
| 2 | **Company Setup** | Company name, logo upload, industry, size, website |
| 3 | **Verification** | Work-email domain verification OR company-registration-doc upload; screen shows a `LoadingState` while verification is pending, with an `EmptyState`-style "You can browse now, verification unlocks posting" interim state so recruiters aren't fully blocked |
| 4 | **Job Creation** | Multi-step form: title, description (rich text, min/max length guardrails), salary band, location/work-mode, seniority |
| 5 | **Define Required Skills & Filters** | `SkillChip` picker (typeahead + suggested-from-title chips), experience range, must-have vs. nice-to-have skill tiers — this tiering feeds the match-score weighting |
| 6 | **Recruiter Candidate Swipe Deck** | Per active job listing (job selector at top). Same mechanics as §5/§7, card per §6 |
| 7 | **Candidate Details** | Full `ProfileSection` breakdown mirroring Job Details, resume preview modal, portfolio/GitHub links |
| 8 | **Filters** | Experience range, location, availability/notice period, skill must-haves |
| 9 | **Matches (list)** | Same pattern as candidate matches list, grouped by job listing |
| 10 | **Chat** | Same `ChatBubble` component, recruiter side can attach `InterviewSlotCard` composer (pick multiple proposed slots at once) |
| 11 | **Interview Scheduling** | Recruiter proposes N slots → sees candidate's confirmation state live → calendar sync confirmation |
| 12 | **Job Management** | List of active/closed job listings with status chips (`Active`, `Paused`, `Filled`, `Archived`), swipe-deck stats per job (views, matches, shortlist rate) |
| 13 | **Profile / Settings** | Company profile, team members (future multi-seat), notification prefs, billing (if applicable), logout |

---

## 10. Navigation

Root navigator is a **stack** that switches its child navigator entirely based on the role chosen at signup (persisted; changeable later from Settings only via a confirmation modal, since candidate/recruiter are structurally different apps sharing a design system).

```
RootStack
├── OnboardingStack        (pre-auth: Splash → Onboarding → RoleSelect → Auth)
├── CandidateRootTabs       (post-auth, role = candidate)
│   ├── DiscoverTab         → SwipeDeckScreen → JobDetailsScreen (push)
│   │                                        → FilterSheet (modal)
│   ├── MatchesTab          → MatchesListScreen → ChatScreen (push)
│   │                                           → InterviewSchedulingModal
│   └── ProfileTab          → ProfileScreen → EditProfileScreen (push)
│                                            → SettingsScreen (push)
└── RecruiterRootTabs        (post-auth, role = recruiter)
    ├── DiscoverTab          → JobSelectorHeader + SwipeDeckScreen → CandidateDetailsScreen (push)
    │                                                              → FilterSheet (modal)
    ├── JobsTab              → JobManagementListScreen → JobCreateFlowStack (modal stack)
    │                                                   → JobDetailsEditScreen (push)
    ├── MatchesTab           → MatchesListScreen → ChatScreen (push)
    │                                            → InterviewSchedulingModal
    └── ProfileTab           → CompanyProfileScreen → SettingsScreen (push)
```

- Bottom tab bar: 3 tabs (candidate) / 4 tabs (recruiter), navy chrome, icons per §1.
- `ChatScreen`, `JobDetailsScreen`, `CandidateDetailsScreen` are **push** (native stack, swipe-back gesture enabled).
- `FilterSheet`, `InterviewSchedulingModal`, `JobCreateFlowStack` are **modal presentation** (`BottomSheet` or `fullScreenModal` per §4).
- Deep links (push-notification driven) route directly into `ChatScreen` or `MatchesListScreen` via a linking config keyed on `matchId`.

---

## 11. API & Integration Specification

All requests go through a single `apiClient` (Axios or `ky`) with a base URL, JWT access-token injection, and automatic refresh-token retry on 401. WebSocket connection is a singleton managed by a `SocketProvider` context, established once per session.

### 11.1 Backend API (NestJS REST)

| | |
|---|---|
| Purpose | Core CRUD: profiles, job listings, swipe records, matches |
| Base | `https://api.swipehire.app/v1` |
| Auth | `Authorization: Bearer <accessToken>` (JWT, 15min expiry + refresh-token rotation) |
| Loading | Every list screen shows `LoadingState — skeleton` on first load, `pull-to-refresh` spinner on subsequent |
| Error | Network/5xx → `ErrorState` inline banner with Retry; 4xx validation → inline field errors, never a generic alert |

### 11.2 Authentication

| | |
|---|---|
| Endpoint | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/oauth/{provider}` |
| Request | `{ phone }` → OTP request; `{ phone, otp }` → verify |
| Response | `{ accessToken, refreshToken, user, isNewUser }` |
| Error behavior | Invalid OTP → inline error under the OTP input, 3-attempt lockout with a 60s cooldown shown as a countdown |
| Loading | Button enters `loading` state (§4.2), OTP inputs disabled during verification |

### 11.3 Resume Upload

| | |
|---|---|
| Purpose | Upload resume file to storage |
| Endpoint | `POST /candidates/resume` (multipart) → stores to S3, returns a signed reference |
| Request | `multipart/form-data`, file (PDF/DOCX, max 5MB) |
| Response | `{ resumeId, fileUrl, status: 'uploaded' }` |
| Error | File-too-large / wrong-type caught client-side before upload; server error → retry affordance on the upload card itself |
| Loading | Determinate progress bar (`LoadingState — progress`) driven by `onUploadProgress` |

### 11.4 Resume Parsing (NLP)

| | |
|---|---|
| Purpose | Extract skills, experience, education from the uploaded resume; produce the embedding vector used for matching |
| Endpoint | `POST /candidates/resume/{resumeId}/parse` (kicks off async job) → client polls `GET /candidates/resume/{resumeId}/status` every 2s, or subscribes to a `resume.parsed` WebSocket event for the same result without polling |
| Response | `{ status: 'processing' \| 'complete' \| 'failed', extracted: { skills[], experience[], education[] }, confidence: {...} }` |
| Error | `failed` status → `ErrorState` with "Re-upload" and "Fill manually instead" fallback paths — parsing must never be a hard blocker to completing signup |
| Loading | Staged copy per §9.1 screen 7, backed by the real `status` enum, not a fixed timer |

### 11.5 Matching

| | |
|---|---|
| Purpose | Return ranked job/candidate cards for the swipe deck, using pgvector cosine similarity between the candidate's resume embedding and each job's requirement embedding, re-ranked by recency/location/salary-fit filters |
| Endpoint | `GET /discover/jobs?cursor&limit=20` (candidate side) / `GET /discover/candidates?jobId&cursor&limit=20` (recruiter side) |
| Response | `{ items: [{ ...cardData, matchPercent, matchBreakdown: { skillsFit, experienceFit, locationFit } }], nextCursor }` |
| Error | Empty/failed page → deck shows `EmptyState` (§13), never an infinite skeleton |
| Loading | First page: `skeleton` deck (3 stacked skeleton cards); subsequent pages: silent prefetch, no visible loading state (§8) |

### 11.6 Swipe Recording

| | |
|---|---|
| Purpose | Record each swipe action, check for mutual match |
| Endpoint | `POST /swipes` (batched array body per §8's debounced flush) |
| Request | `{ swipes: [{ targetId, targetType, action: 'pass' \| 'shortlist' \| 'fasttrack', clientTimestamp }] }` |
| Response | `{ results: [{ targetId, matched: boolean, matchId? }] }` |
| Backend note | Swipes are recorded into a Redis queue for low-latency write, then asynchronously persisted to Postgres; a mutual-match check runs against the Redis pending-swipe set on every right-swipe/fast-track write |
| Error | Failed batch → re-queued locally, retried on next flush cycle; swipe UI never rolls back visually (optimistic, per §8) |

### 11.7 Chat / WebSockets

| | |
|---|---|
| Purpose | Real-time messaging within a match |
| Transport | Socket.io, namespaced per match: `socket.emit('chat:send', { matchId, text })`, `socket.on('chat:message', ...)` |
| Auth | Socket handshake carries the JWT; server validates match membership before joining the room |
| Response/event shape | `{ id, matchId, senderId, text, sentAt, status: 'sent' \| 'delivered' \| 'read' }` |
| Error behavior | Disconnect → `ChatBubble` composer shows an inline "Reconnecting…" strip; unsent messages queue locally and flush on reconnect, marked with a small clock icon until confirmed |
| Loading | Optimistic bubble render (greyed-out) immediately on send, resolves to full opacity on `delivered` ack |

### 11.8 Push Notifications

| | |
|---|---|
| Purpose | New match, new message, interview-slot proposed/confirmed |
| Provider | Expo Notifications (or FCM/APNs directly if ejected from Expo) |
| Registration | Device push token registered to `POST /devices/register` on login |
| Payload | `{ type: 'match' \| 'message' \| 'interview', matchId, title, body }` — tapping deep-links via the linking config in §10 |
| Error | Registration failure is silent/non-blocking — in-app notification list (bell icon, future scope) remains the source of truth |

### 11.9 Calendar / Interview Scheduling

| | |
|---|---|
| Purpose | Sync a confirmed interview slot to the candidate's and recruiter's calendars |
| Endpoint | `POST /interviews` `{ matchId, proposedSlots: [ISO8601] }` (recruiter) → `POST /interviews/{id}/confirm` `{ slot: ISO8601 }` (candidate) → `POST /interviews/{id}/calendar-sync` |
| Integration | Google Calendar API (OAuth scope requested at the interview-scheduling step, not at signup, to minimize upfront permission asks) |
| Response | `{ interviewId, status: 'proposed' \| 'confirmed' \| 'synced', calendarEventUrl } ` |
| Error | Calendar sync failure doesn't block the interview confirmation — shows a non-blocking banner "Interview confirmed — add to calendar manually" with an `.ics` download fallback |
| Loading | Each slot-proposal and confirmation action uses inline button `loading` state, not a full-screen block |

---

## 12. Responsive & Accessibility Rules

| Concern | Rule |
|---|---|
| Phone sizes | Design at a 390×844 (iPhone 14) base. Small devices (iPhone SE, 375×667): swipe card max-height reduces to `screenHeight * 0.68`; action-row buttons shrink from `md` to `sm`. Large devices / Android tablets: content max-width caps at 480px, centered, rather than stretching cards edge-to-edge |
| Safe areas | All screens wrapped in `SafeAreaView`/`useSafeAreaInsets`; bottom tab bar height = `56 + insets.bottom`; swipe deck bottom action row sits above the tab bar with 12px clearance, never overlapping the home indicator |
| Dynamic text | Supports iOS/Android system font scaling up to 130% (`allowFontScaling` true) for `body`, `caption`, `h1–h3`; capped at 115% for `type.button` and card title fields to prevent card-layout breakage; `type.data.*` capped at 100% (numeric precision matters more than scale here — see §3.2) |
| Touch targets | Minimum 44×44pt for every interactive element, including chip "×" remove buttons and the MatchSeal tap target (visually 32px at `sm` but hit-slop expanded to 44×44) |
| Screen readers | Every `SwipeCard` exposes an `accessibilityLabel` summarizing the full card ("Senior Backend Engineer at Razorpay, Bengaluru, 76 percent match") and `accessibilityActions` for Pass/Shortlist/Fast-Track as an alternative to the gesture, since drag gestures are not reliably operable via VoiceOver/TalkBack. A `AccessibilityInfo.isScreenReaderEnabled()` check swaps the deck into a scrollable list-with-buttons mode automatically |
| Contrast | All text/background pairs meet WCAG AA (4.5:1 body, 3:1 large text/`h1-h2`); the gold `secondary` (`#D6A24C`) is never used for text on `background` — only as a fill/border, since its contrast on paper fails AA at body sizes |
| Keyboard handling | `KeyboardAvoidingView` (`behavior: 'padding'` iOS / `'height'` Android) on every screen with a text input; Chat composer stays pinned above the keyboard with no layout jump (measured via `useKeyboardHandler` from `react-native-keyboard-controller` for frame-synced resize) |
| Reduced motion | Respects `AccessibilityInfo.isReduceMotionEnabled()` — swipe-follow and card-promotion animations still run (they're core interaction, not decoration) but the Match-screen arc-sweep and skeleton shimmer are replaced with instant-state equivalents |

---

## 13. Empty / Error / Loading States

| Scenario | Treatment |
|---|---|
| **No jobs** (candidate deck exhausted current filters) | `EmptyState`: icon (empty folder/dossier), `h2` "No roles match your filters right now", `body.m` "Try widening your salary range or location", CTA button → opens `FilterSheet` |
| **No candidates** (recruiter deck exhausted) | `EmptyState`: `h2` "You've seen everyone who matches this listing", CTA "Adjust required skills" → Filters |
| **No matches yet** | `EmptyState`: `h2` "No matches yet", `body.m` "Keep swiping — matches show up here the moment it's mutual", no CTA (points back to the tab bar's Discover tab implicitly) |
| **Failed network** (any screen) | `ErrorState`: icon (disconnected plug), "Couldn't load — check your connection", `Button` "Retry"; list screens keep the last successfully-loaded cached data visible behind a dismissible banner rather than blanking the screen |
| **Resume processing failed** | Inline `ErrorState` on the parsing-status screen: "We couldn't read that file", two buttons — "Try another file" / "Fill in manually" (never a dead end) |
| **No more cards** (end of current page, more may load) | Last card in the rolling window shows a subtle "Loading more…" skeleton edge peeking from behind rather than a jarring blank |
| **Chat failure** (message send fails) | Bubble renders with a small red exclamation + "Failed to send · Tap to retry", tapping resends that single message without re-sending the whole conversation |
| **Interview scheduling failure** (slot conflict / calendar sync failure) | Inline banner within the scheduling modal: "That slot's no longer available — pick another" (conflict) or the non-blocking calendar-sync fallback described in §11.9 |

Loading states always match the shape of the content they replace (skeleton cards are card-shaped, skeleton list rows are row-shaped) — never a centered generic spinner for anything above single-button scope.

---

## 14. Frontend Folder Structure

```
src/
├── app/                        # Navigation root, linking config, role-based stack switch (§10)
│   ├── RootNavigator.tsx
│   ├── CandidateNavigator.tsx
│   └── RecruiterNavigator.tsx
│
├── screens/
│   ├── onboarding/              # Splash, Onboarding, RoleSelect, Auth
│   ├── candidate/                # Screens listed in §9.1
│   │   ├── discover/
│   │   ├── matches/
│   │   └── profile/
│   └── recruiter/                # Screens listed in §9.2
│       ├── discover/
│       ├── jobs/
│       ├── matches/
│       └── profile/
│
├── components/
│   ├── ui/                       # Button, Input, Card, Modal, BottomSheet, TabBar, SegmentedControl — generic, app-agnostic
│   ├── swipe/                    # SwipeCard, SwipeDeck, MatchSeal, gesture hooks
│   ├── chat/                     # ChatBubble, InterviewSlotCard, Composer
│   ├── profile/                  # ProfileSection building blocks
│   ├── job/                      # JobSection building blocks
│   └── feedback/                 # EmptyState, ErrorState, LoadingState, NotificationToast
│
├── hooks/
│   ├── useSwipeGesture.ts        # §7.3 core gesture logic, shared between job/candidate decks
│   ├── useSwipeQueue.ts          # optimistic queue + batched flush (§8)
│   ├── useSocket.ts              # Socket.io connection lifecycle
│   ├── useKeyboardOffset.ts
│   └── useMatchBreakdown.ts      # tap-to-expand MatchSeal popover data
│
├── services/
│   ├── api/                      # apiClient, endpoint modules mirroring §11 (auth.ts, discover.ts, swipes.ts, chat.ts, interviews.ts)
│   ├── socket/                   # socket instance + event typing
│   └── storage/                  # MMKV/SQLite local queue + cache
│
├── store/                        # Zustand or Redux Toolkit slices: auth, profile, deck, matches, chat
│
├── theme/
│   ├── tokens.ts                 # §15 — colors, type, spacing, radius, shadow, motion
│   ├── ThemeProvider.tsx         # light/dark resolution
│   └── typography.ts
│
├── types/                        # Shared TS types/interfaces (Job, Candidate, Match, Message, Interview)
│
├── utils/                        # formatters (salary, relative time), validators
│
└── assets/
    ├── fonts/                    # Fraunces, Inter, IBM Plex Mono weights
    ├── icons/                    # Phosphor icon set subset
    └── illustrations/            # Onboarding + empty-state illustrations
```

---

## 15. Design Tokens

Single source of truth consumed by `theme/tokens.ts` — every component references these, never raw values.

```ts
export const tokens = {
  color: {
    primary: '#3B4FE0',
    primaryPressed: '#2A3AB0',
    primaryTint: '#EEF0FD',
    secondary: '#D6A24C',
    secondaryTint: '#FBF1DF',
    background: '#F7F5F1',
    backgroundChrome: '#0F1629',
    surface: '#FFFFFF',
    surfaceAlt: '#FCFBF9',
    border: '#E4E1DA',
    borderStrong: '#CBC7BD',
    textPrimary: '#14171F',
    textSecondary: '#5B6472',
    textInverse: '#F7F5F1',
    success: '#1F9D6F',
    successTint: '#E4F5EC',
    warning: '#C97A2E',
    warningTint: '#FBEDDD',
    error: '#D0453B',
    errorTint: '#FBE7E5',
    swipeRight: '#1F9D6F',
    swipeLeft: '#5B6472',
    swipeFastTrack: '#D6A24C',
  },

  typography: {
    fontFamily: {
      display: 'Fraunces',
      body: 'Inter',
      mono: 'IBMPlexMono',
    },
    scale: {
      displayXl: { fontSize: 40, lineHeight: 48, fontWeight: '600', fontFamily: 'Fraunces' },
      displayL:  { fontSize: 32, lineHeight: 40, fontWeight: '600', fontFamily: 'Fraunces' },
      h1:        { fontSize: 28, lineHeight: 34, fontWeight: '600', fontFamily: 'Fraunces' },
      h2:        { fontSize: 22, lineHeight: 28, fontWeight: '600', fontFamily: 'Fraunces' },
      h3:        { fontSize: 18, lineHeight: 24, fontWeight: '600', fontFamily: 'Inter' },
      bodyL:     { fontSize: 16, lineHeight: 24, fontWeight: '400', fontFamily: 'Inter' },
      bodyM:     { fontSize: 14, lineHeight: 20, fontWeight: '400', fontFamily: 'Inter' },
      caption:   { fontSize: 12, lineHeight: 16, fontWeight: '500', fontFamily: 'Inter' },
      button:    { fontSize: 15, lineHeight: 20, fontWeight: '600', fontFamily: 'Inter', letterSpacing: 0.2 },
      dataL:     { fontSize: 20, lineHeight: 24, fontWeight: '500', fontFamily: 'IBMPlexMono' },
      dataS:     { fontSize: 13, lineHeight: 18, fontWeight: '400', fontFamily: 'IBMPlexMono' },
    },
  },

  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },

  radius: { sm: 8, md: 12, lg: 16, pill: 999 },

  shadow: {
    card: { shadowColor: '#14171F', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    modal: { shadowColor: '#14171F', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  },

  motion: {
    duration: { fast: 150, base: 250, slow: 400, sealSweep: 900 },
    spring: { damping: 18, stiffness: 180, mass: 1 },   // card promotion / undo
    easing: { standard: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  },
} as const;
```

---

*End of specification. All hex values, type scales, and API shapes above are implementation-ready; component behavior notes are detailed enough to build screens without further design decisions. Flag the §6 photo-visibility default and the §11.9 calendar OAuth-scope timing to product before build, since both are policy calls, not pure frontend ones.*
