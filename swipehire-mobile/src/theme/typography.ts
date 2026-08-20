import type { TextStyle } from 'react-native';

import { tokens } from './tokens';

/**
 * Bridges the spec's type scale (Frontend Spec §3.1, expressed as family + numeric weight) onto the
 * concrete font files loaded from @expo-google-fonts.
 *
 * React Native picks a custom face by *name*, not by family + weight: setting `fontWeight` alongside
 * a custom `fontFamily` makes the OS synthesise a fake bold on top of an already-bold face. So the
 * weight is folded into the family name here and `fontWeight` is deliberately never emitted.
 */

const FONT_FILES = {
  Fraunces: { '600': 'Fraunces_600SemiBold' },
  Inter: {
    '400': 'Inter_400Regular',
    '500': 'Inter_500Medium',
    '600': 'Inter_600SemiBold',
  },
  IBMPlexMono: {
    '400': 'IBMPlexMono_400Regular',
    '500': 'IBMPlexMono_500Medium',
  },
} as const;

/** Every face the app must load before rendering text. Consumed by `useAppFonts`. */
export const REQUIRED_FONTS = [
  'Fraunces_600SemiBold',
  'Inter_400Regular',
  'Inter_500Medium',
  'Inter_600SemiBold',
  'IBMPlexMono_400Regular',
  'IBMPlexMono_500Medium',
] as const;

export type TypeToken = keyof typeof tokens.typography.scale;

/**
 * Resolve a type token to a ready-to-spread `TextStyle`.
 *
 * Mono tokens get `tabular-nums` so digits share a fixed advance width — without it, a match score
 * ticking 78 → 81 visibly reflows the layout, which reads as sloppy on a card that is supposed to
 * feel like an instrument reading.
 */
export function type(token: TypeToken): TextStyle {
  const spec = tokens.typography.scale[token];
  const family = spec.fontFamily as keyof typeof FONT_FILES;
  const weights = FONT_FILES[family] as Record<string, string>;
  const resolved = weights[spec.fontWeight];

  const style: TextStyle = {
    fontFamily: resolved,
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
  };

  if ('letterSpacing' in spec) style.letterSpacing = spec.letterSpacing;
  if (family === 'IBMPlexMono') style.fontVariant = ['tabular-nums'];

  return style;
}
