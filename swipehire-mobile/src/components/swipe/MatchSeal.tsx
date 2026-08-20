import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, Mask, Path } from 'react-native-svg';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The Match Seal — SwipeHire's signature element (Frontend Spec §0, §4.3).
 *
 * A calibration dial, not a progress ring: 24 tick marks form a gauge bezel, and an indigo→gold arc
 * fills clockwise from 12 o'clock in proportion to the score. Built once here and reused everywhere
 * a match score appears — never reimplemented per screen.
 *
 * The gradient runs ALONG the arc, not across the box. §2.2 ties the colours to meaning — indigo is
 * low confidence, gold is high — so the colour has to track the value: a 40% seal must read as
 * clearly cooler than a 92% one. A plain SVG linear gradient can't do that, since it varies by
 * position rather than by angle, which leaves every score looking much the same and reduces the
 * seal to an arc-length readout. So the ring is drawn as discrete segments whose colour is
 * interpolated by angle, and an animated mask reveals them 0 → matchPercent.
 *
 * Motion is `withTiming` with an ease-out cubic, never a spring. §4.3 is explicit about why: a
 * spring overshoot on a *measurement* reads as imprecise, which undercuts the whole metaphor.
 */

const SIZES = { sm: 32, md: 56, lg: 96 } as const;
const TICK_COUNT = 24;
/** Enough segments that the banding isn't visible even on the 96px seal. */
const ARC_SEGMENTS = 72;

export interface MatchSealProps {
  /** 0–100. Values outside the range are clamped rather than drawn as an overflowing arc. */
  matchPercent: number;
  size?: keyof typeof SIZES;
  /** Sweep the arc from 0 on mount. Used on card entry and the match-celebration screen. */
  animateIn?: boolean;
}

function lerpHex(from: string, to: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [parse(from), parse(to)];
  return (
    '#' +
    a
      .map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Arc path between two angles, measured in degrees clockwise from 12 o'clock. */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = point(startDeg);
  const [x2, y2] = point(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
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

  /** The mask stroke: shortening its dash reveals less of the coloured ring beneath. */
  const maskProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
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

  const segments = Array.from({ length: ARC_SEGMENTS }, (_, i) => {
    const step = 360 / ARC_SEGMENTS;
    // Segments overlap by a hair so no seam shows between them.
    const start = i * step;
    const end = start + step + 0.6;
    return {
      key: i,
      d: arcPath(center, center, radius, start, Math.min(end, 360)),
      // Colour is a function of position around the FULL dial, so a given score always lands on
      // the same colour regardless of the size it's rendered at.
      color: lerpHex(tokens.color.primary, tokens.color.secondary, i / (ARC_SEGMENTS - 1)),
    };
  });

  /**
   * Spec §4.3 sets the numeral in "type.data.l / type.data.s (mono, size-dependent)". Only the
   * 96px seal has the clear interior for data.l — at 56px, "92%" in 20px mono is wider than the
   * ~31px of space inside the ring and collides with the arc.
   */
  const labelStyle = size === 'lg' ? type('dataL') : type('dataS');
  // 32px leaves room for two digits but not a percent sign as well.
  const label = size === 'sm' ? `${pct}` : `${pct}%`;

  /**
   * At 32px there is roughly 20pt of clear space inside the ring, and "100" in 13pt mono is wider
   * than that — it collided with the arc on a perfect match, which is exactly the score most worth
   * showing off. Only the three-digit case needs the reduction, so two-digit scores keep the
   * spec's size.
   */
  const labelOverride =
    size === 'sm' && label.length > 2 ? { fontSize: 11, lineHeight: 13 } : null;

  return (
    <View
      style={{ width: px, height: px }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Match score ${pct} percent`}
    >
      <Svg width={px} height={px}>
        <Defs>
          <Mask id={`sealMask${px}`}>
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke="#fff"
              // Slightly wider than the band it reveals, so the mask's own antialiased edge can't
              // clip the colour.
              //
              // KNOWN COSMETIC ISSUE: a faint grey halo still sits behind the coloured arc on the
              // 56px seal — the track reads wider than the fill even though both use arcStroke at
              // the same radius. Widening this mask didn't account for it, so the cause is
              // something else and the guess isn't worth more chasing right now. Visible only on
              // close inspection; revisit during the DEMO-18 polish pass.
              strokeWidth={arcStroke + 2}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              animatedProps={maskProps}
              // Rotated so the reveal begins at 12 o'clock and runs clockwise.
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Mask>
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

        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={tokens.color.border}
          strokeWidth={arcStroke}
          fill="none"
        />

        <G mask={`url(#sealMask${px})`}>
          {segments.map((s) => (
            <Path key={s.key} d={s.d} stroke={s.color} strokeWidth={arcStroke} fill="none" />
          ))}
        </G>
      </Svg>

      <View style={styles.labelWrap} pointerEvents="none">
        <Text
          style={[labelStyle, styles.label, labelOverride]}
          numberOfLines={1}
          allowFontScaling={false}
        >
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
