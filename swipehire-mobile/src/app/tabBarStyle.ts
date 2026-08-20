import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

import { tokens } from '../theme/tokens';
import { type } from '../theme/typography';

/**
 * Tab bar styling — Frontend Spec §4.1: navy chrome, active label in primary, inactive at 55%.
 *
 * Labels only. The spec's icons are Phosphor duotone, which isn't installed, and §1 rules out
 * substituting an emoji-style set — so this ships as a typographic tab bar rather than with the
 * wrong icons. Noted as a gap; adding the icon set later is a props change, not a rework.
 */
export const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: tokens.color.backgroundChrome,
    borderTopWidth: 0,
    height: 64,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
  },
  tabBarLabelStyle: type('caption'),
  tabBarActiveTintColor: tokens.color.textInverse,
  // Dimmed rather than a different hue, so both states sit on the same navy without a second
  // colour token to keep in step.
  tabBarInactiveTintColor: 'rgba(247, 245, 241, 0.55)',
  tabBarItemStyle: { paddingVertical: tokens.spacing.xs },
  // Without this, React Navigation draws its own placeholder glyph — a bare triangle that reads as
  // a missing asset. Labels alone are the deliberate choice until the Phosphor set is wired up.
  tabBarIcon: () => null,
  tabBarIconStyle: { display: 'none' },
};
