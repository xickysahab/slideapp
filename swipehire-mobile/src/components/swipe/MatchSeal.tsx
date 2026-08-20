import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Stop } from 'react-native-svg';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The Match Seal — SwipeHire's signature element (Frontend Spec §0, §4.3).
 *
 * A calibration dial, not a progress ring: 24 tick marks form a gauge bezel, and an indigo→gold arc
 * fills clockwise from 12 o'clock in proportion to the score. Built once here and reused everywhere
 * a match score appears (job card, candidate card, match screen, chat header, matches list) — never
 * reimplemented per screen.
 *
 * Motion is `withTiming` with an ease-out cubic, never a spring. Spec §4.3 is explicit about why:
 * a spring overshoot on a *measurement* reads as imprecise, which undercuts the whole metaphor.
 */

const SIZES = { sm: 32, md: 56, lg: 96 } as const;
const TICK_COUNT = 24;

export interface MatchSealProps {
  /** 0–100. Values outside the range are clamped rather than drawn as an overflowing arc. */
  matchPercent: number;
  size?: keyof typeof SIZES;
  /** Sweep the arc from 0 on mount. Used on card entry and the match-celebration screen. */
  animateIn?: boolean;
}

function MatchSealComponent({ matchPercent, size = 'md', animateIn = false }: MatchSealProps) {
  const px = SIZES[size];
  const pct = Math.max(0, Math.min(100, Math.round(matchPercent)));

  // Geometry scales off the diameter so every size keeps the same visual proportions.
  const center = px / 2;
  const tickLength = px * 0.08;
  const tickGap = px * 0.05;
  const arcStroke = px * 0.09;
  const radius = center - tickLength - tickGap - arcStroke / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(animateIn ? 0 : pct);

  useEffect(() => {
    if (animateIn) {
      progress.value = withTiming(pct, {
        duration: tokens.motion.duration.sealSweep,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = pct;
    }
  }, [pct, animateIn, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    // Start at 12 o'clock and step clockwise, matching the arc's direction.
    const angle = (i / TICK_COUNT) * 2 * Math.PI - Math.PI / 2;
    const inner = center - tickLength;
    return {
      key: i,
      x1: center + inner * Math.cos(angle),
      y1: center + inner * Math.sin(angle),
      x2: center + center * Math.cos(angle),
      y2: center + center * Math.sin(angle),
    };
  });

  // At 32px there is roughly 20px of clear space inside the ring — enough for two mono digits, not
  // for a percent sign as well. The bigger sizes carry it.
  const label = size === 'sm' ? `${pct}` : `${pct}%`;
  const labelStyle = size === 'sm' ? type('dataS') : type('dataL');

  return (
    <View
      style={{ width: px, height: px }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Match score ${pct} percent`}
    >
      <Svg width={px} height={px}>
        <Defs>
          <LinearGradient id="sealArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tokens.color.primary} />
            <Stop offset="1" stopColor={tokens.color.secondary} />
          </LinearGradient>
        </Defs>

        {ticks.map((t) => (
          <Line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={tokens.color.borderStrong}
            strokeWidth={Math.max(0.5, px * 0.012)}
            strokeLinecap="round"
          />
        ))}

        {/* Rotated so both the track and the fill begin at 12 o'clock and run clockwise. */}
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={tokens.color.border}
            strokeWidth={arcStroke}
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#sealArc)"
            strokeWidth={arcStroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      <View style={styles.labelWrap} pointerEvents="none">
        <Text style={[labelStyle, styles.label]} numberOfLines={1} allowFontScaling={false}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: tokens.color.textPrimary },
});

/**
 * Score and size are the only inputs that change what's drawn, so the deck re-rendering on every
 * gesture frame must not re-render the seal (Frontend Spec §8, memoization row).
 */
export const MatchSeal = memo(
  MatchSealComponent,
  (a, b) => a.matchPercent === b.matchPercent && a.size === b.size && a.animateIn === b.animateIn,
);
