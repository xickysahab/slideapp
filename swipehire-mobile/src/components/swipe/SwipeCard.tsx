import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { tokens } from '../../theme/tokens';
import type { SwipeCardData, SwipeDirection } from '../../types';
import {
  formatExperience,
  formatSalaryRange,
  formatWorkMode,
  formatYears,
} from '../../utils/format';
import { Button } from '../ui/Button';
import { CandidateCardContent } from './CandidateCardContent';
import { JobCardContent } from './JobCardContent';
import { SwipeStamp } from './SwipeStamp';

/**
 * SwipeCard — Frontend Spec §5 / §6 / §7.
 *
 * Owns the gesture, the drag stamps, and the action row. The action row is not decoration: it is
 * the non-gesture path to the same two outcomes, which is what keeps the deck usable for anyone who
 * can't complete a drag (§5, §6 action row; §12 accessibility).
 *
 * Only the top card (`stackPosition === 0`) is interactive. The two behind it render fully so the
 * promotion animation has no layout jump, but they don't accept touches.
 */

export interface SwipeCardProps {
  card: SwipeCardData;
  /** 0 = top/interactive, 1 = next, 2 = next+1. */
  stackPosition: number;
  onSwipe: (direction: SwipeDirection) => void;
  onPressDetails?: () => void;
  cardWidth: number;
  cardHeight: number;
  screenWidth: number;
}

/** A screen reader gets the card's substance in one string, in the order the eye reads it. */
function describe(card: SwipeCardData): string {
  if (card.kind === 'job') {
    const j = card.data;
    return [
      `${j.title} at ${j.companyName}`,
      `${j.locationCity}, ${formatWorkMode(j.workMode)}`,
      formatSalaryRange(j.compMin, j.compMax),
      formatExperience(j.experienceMinYears, j.experienceMaxYears),
      `${j.matchScore} percent match`,
      `Skills: ${j.techStack.join(', ')}`,
    ].join('. ');
  }
  const c = card.data;
  return [
    `${c.firstName} ${c.lastInitial}`,
    c.currentTitle,
    `${formatYears(c.yearsExperience)}, ${c.locationCity}`,
    `${c.matchScore} percent match`,
    `Skills: ${c.skills.join(', ')}`,
    c.keyAchievement ?? '',
  ]
    .filter(Boolean)
    .join('. ');
}

function SwipeCardComponent({
  card,
  stackPosition,
  onSwipe,
  onPressDetails,
  cardWidth,
  cardHeight,
  screenWidth,
}: SwipeCardProps) {
  const interactive = stackPosition === 0;

  const { gesture, cardStyle, passStampStyle, shortlistStampStyle, swipeProgrammatically } =
    useSwipeGesture({
      cardWidth,
      cardHeight,
      screenWidth,
      onSwipe,
      enabled: interactive,
      stackPosition,
    });

  const handlePass = useCallback(() => swipeProgrammatically('left'), [swipeProgrammatically]);
  const handleShortlist = useCallback(() => swipeProgrammatically('right'), [swipeProgrammatically]);

  const label = card.kind === 'job' ? 'job' : 'candidate';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          { width: cardWidth, maxHeight: cardHeight, zIndex: 10 - stackPosition },
          cardStyle,
        ]}
        // Only the front card should be reachable by a screen reader; the stack behind it is
        // decoration until it's promoted.
        accessibilityElementsHidden={!interactive}
        importantForAccessibility={interactive ? 'yes' : 'no-hide-descendants'}
      >
        <Pressable
          onPress={onPressDetails}
          disabled={!interactive || !onPressDetails}
          accessibilityRole="button"
          accessibilityLabel={describe(card)}
          accessibilityHint={onPressDetails ? `Opens full ${label} details` : undefined}
        >
          {card.kind === 'job' ? (
            <JobCardContent job={card.data} />
          ) : (
            <CandidateCardContent candidate={card.data} />
          )}
        </Pressable>

        <View style={styles.actionRow}>
          <Button
            label="Pass"
            variant="ghost"
            onPress={handlePass}
            fullWidth
            accessibilityHint={`Skips this ${label}. It won't be shown again.`}
          />
          <Button
            label="Shortlist"
            variant="primary"
            onPress={handleShortlist}
            fullWidth
            accessibilityHint={`Registers interest in this ${label}.`}
          />
        </View>

        {interactive && (
          <>
            <SwipeStamp kind="shortlist" style={shortlistStampStyle} />
            <SwipeStamp kind="pass" style={passStampStyle} />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    backgroundColor: tokens.color.surface,
    // 16px — moderate, never pill. A fully rounded card reads as a game, not a dossier (§1).
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    // A single soft ambient shadow, not a layered floating stack (§1).
    ...tokens.shadow.card,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
  },
});

/**
 * The deck re-renders as the index advances; without this the gesture instance would be rebuilt on
 * every one of those renders (§8, memoization row).
 */
export const SwipeCard = memo(
  SwipeCardComponent,
  (a, b) =>
    a.card.data.id === b.card.data.id &&
    a.stackPosition === b.stackPosition &&
    a.cardWidth === b.cardWidth &&
    a.cardHeight === b.cardHeight,
);
