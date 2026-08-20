import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { tokens } from '../../theme/tokens';

/**
 * Skeleton loaders — Frontend Spec §4.1 / §13.
 *
 * Card-shaped shimmer rather than a spinner. Demo Frontend Spec §6 is specific about why: a bare
 * spinner during a live demo reads as unfinished, while a skeleton reads as loading.
 */

function useShimmer() {
  const progress = useSharedValue(0.4);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [progress]);

  return useAnimatedStyle(() => ({ opacity: progress.value }));
}

/** One shimmering block. Compose these into a shape that matches whatever is loading. */
export function SkeletonBlock({ height, width, radius = tokens.radius.sm }: { height: number; width?: number | `${number}%`; radius?: number }) {
  const shimmer = useShimmer();
  return (
    <Animated.View
      style={[
        { height, width: width ?? '100%', borderRadius: radius, backgroundColor: tokens.color.surfaceAlt },
        shimmer,
      ]}
    />
  );
}

/** Stands in for a swipe card while the first page loads. */
export function DeckSkeleton() {
  return (
    <View style={styles.deck} accessibilityLabel="Loading cards">
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonBlock height={40} width={40} radius={tokens.radius.sm} />
          <SkeletonBlock height={56} width={56} radius={tokens.radius.pill} />
        </View>
        <SkeletonBlock height={24} width="70%" />
        <SkeletonBlock height={16} width="45%" />
        <SkeletonBlock height={28} width="55%" />
        <View style={styles.chips}>
          <SkeletonBlock height={26} width={80} radius={tokens.radius.pill} />
          <SkeletonBlock height={26} width={96} radius={tokens.radius.pill} />
          <SkeletonBlock height={26} width={72} radius={tokens.radius.pill} />
        </View>
        <SkeletonBlock height={16} />
        <SkeletonBlock height={16} width="80%" />
      </View>
    </View>
  );
}

/** Stands in for a list of rows — matches, jobs. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonBlock height={44} width={44} radius={tokens.radius.pill} />
          <View style={styles.listRowText}>
            <SkeletonBlock height={16} width="60%" />
            <SkeletonBlock height={14} width="85%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.lg },
  card: {
    width: '100%',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    ...tokens.shadow.card,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chips: { flexDirection: 'row', gap: tokens.spacing.sm },
  list: { padding: tokens.spacing.lg, gap: tokens.spacing.lg },
  listRow: { flexDirection: 'row', gap: tokens.spacing.md, alignItems: 'center' },
  listRowText: { flex: 1, gap: tokens.spacing.sm },
});
