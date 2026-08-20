import { StyleSheet, Text } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * The drag overlay stamp — Frontend Spec §7.2: fades in with drag distance, angled -12°, coloured
 * per §2.3. Transient only; never static chrome.
 *
 * Labels: the spec calls the left-drag stamp "SKIP" in §2.3 and "PASS" in §7.2. "PASS" wins here
 * because it matches the action-row button label in §5/§6 — the stamp and the button should not
 * name the same action two different ways.
 *
 * Note the left stamp is slate, not red (§2.3). A pass isn't a failure, and colouring it as one
 * would be exactly the "dating app" grammar §0 rejects.
 */

export type StampKind = 'pass' | 'shortlist';

const CONFIG = {
  pass: { label: 'PASS', color: tokens.color.swipeLeft },
  shortlist: { label: 'SHORTLIST', color: tokens.color.swipeRight },
} as const;

export interface SwipeStampProps {
  kind: StampKind;
  style: AnimatedStyle<ViewStyle>;
}

export function SwipeStamp({ kind, style }: SwipeStampProps) {
  const { label, color } = CONFIG[kind];

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.stamp,
        kind === 'shortlist' ? styles.left : styles.right,
        { borderColor: color },
        style,
      ]}
    >
      <Text style={[type('button'), styles.label, { color }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    top: tokens.spacing.xl,
    borderWidth: 3,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.color.surface,
    transform: [{ rotate: '-12deg' }],
  },
  left: { left: tokens.spacing.xl },
  right: { right: tokens.spacing.xl },
  label: { letterSpacing: 1.5 },
});
