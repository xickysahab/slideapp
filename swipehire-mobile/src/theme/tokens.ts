/**
 * Design tokens — copied VERBATIM from SwipeHire_Frontend_Specification.md §15.
 * Source: docs/full-spec/SwipeHire_Frontend_Specification.md (line 608 onward).
 *
 * DO NOT EDIT THESE VALUES. Demo Frontend Spec §1 keeps the design system unchanged from the full
 * spec on purpose — it is what makes the demo read as a funded product rather than a tutorial clone.
 * If a value here looks wrong, fix it in the spec and re-copy; never hand-tune it in this file.
 *
 * Usage rules (Demo Frontend Spec §1, full spec §4):
 *  - No component may contain a raw hex or px value. Everything comes from here.
 *  - `secondary` / `swipeFastTrack` (#D6A24C gold) is NEVER used for text — fills and borders only.
 *    It fails WCAG AA at body size.
 *  - Type roles don't mix: Fraunces = display, Inter = UI/body, IBMPlexMono = any number that
 *    states a fact (salary, match %, years, timestamps).
 *  - `swipeFastTrack` is retained because it ships in the spec's token block, but the Fast-Track
 *    gesture itself is out of scope for this build (Demo PRD §2 row 15).
 */
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
      displayL: { fontSize: 32, lineHeight: 40, fontWeight: '600', fontFamily: 'Fraunces' },
      h1: { fontSize: 28, lineHeight: 34, fontWeight: '600', fontFamily: 'Fraunces' },
      h2: { fontSize: 22, lineHeight: 28, fontWeight: '600', fontFamily: 'Fraunces' },
      h3: { fontSize: 18, lineHeight: 24, fontWeight: '600', fontFamily: 'Inter' },
      bodyL: { fontSize: 16, lineHeight: 24, fontWeight: '400', fontFamily: 'Inter' },
      bodyM: { fontSize: 14, lineHeight: 20, fontWeight: '400', fontFamily: 'Inter' },
      caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', fontFamily: 'Inter' },
      button: { fontSize: 15, lineHeight: 20, fontWeight: '600', fontFamily: 'Inter', letterSpacing: 0.2 },
      dataL: { fontSize: 20, lineHeight: 24, fontWeight: '500', fontFamily: 'IBMPlexMono' },
      dataS: { fontSize: 13, lineHeight: 18, fontWeight: '400', fontFamily: 'IBMPlexMono' },
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
    spring: { damping: 18, stiffness: 180, mass: 1 }, // card promotion / undo
    easing: { standard: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  },
} as const;

export type Tokens = typeof tokens;
