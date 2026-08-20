import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { tokens } from '../../theme/tokens';
import type { SwipeCardData, SwipeDirection } from '../../types';
import { EmptyState } from '../feedback/EmptyState';
import { SwipeCard } from './SwipeCard';

/**
 * SwipeDeck — the 3-card rolling window from Frontend Spec §8.
 *
 * Deliberately not a list component. List virtualisation fights free-drag gestures (§8, memory
 * management row), so the deck mounts exactly three cards — `current`, `next`, `next+1` — and
 * everything else stays unmounted in the data array.
 *
 * Demo Frontend Spec §1 keeps this rolling window explicitly: it is what makes the deck feel
 * smooth, and it costs the same regardless of how simple the backend is. What the demo *does* cut
 * is the network sophistication behind it — one API call per swipe, no debounced batch flush and
 * no offline queue.
 */

const WINDOW_SIZE = 3;

export interface SwipeDeckProps {
  cards: SwipeCardData[];
  onSwipe: (card: SwipeCardData, direction: SwipeDirection) => void;
  onPressDetails?: (card: SwipeCardData) => void;
  /** Fired once when the last card leaves the deck — used to fetch the next page. */
  onExhausted?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  /**
   * Refetches the deck from the empty state.
   *
   * Without it an exhausted deck is a dead end — the cards are gone, nothing brings them back, and
   * the only way forward is another tab. New listings do appear through the day, so there is
   * genuinely something to fetch.
   */
  onRefresh?: () => void;
}

export function SwipeDeck({
  cards,
  onSwipe,
  onPressDetails,
  onExhausted,
  emptyTitle = 'No more cards right now',
  emptyBody = 'Check back shortly — new listings are added through the day.',
  onRefresh,
}: SwipeDeckProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const cardWidth = width - tokens.spacing.lg * 2;
  // Capped so the action row always clears the tab bar without the card needing to scroll (§5).
  const cardHeight = height * 0.72;

  const handleSwipe = useCallback(
    (card: SwipeCardData, direction: SwipeDirection) => {
      onSwipe(card, direction);
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= cards.length) onExhausted?.();
        return next;
      });
    },
    [cards.length, onSwipe, onExhausted],
  );

  if (index >= cards.length) {
    return (
      <EmptyState
        title={emptyTitle}
        body={emptyBody}
        actionLabel={onRefresh ? 'Check again' : undefined}
        onAction={
          onRefresh
            ? () => {
                // Reset the window too, or a refetch would return cards the deck has already
                // scrolled past its own index.
                setIndex(0);
                onRefresh();
              }
            : undefined
        }
      />
    );
  }

  // Rendered back-to-front so the stacking order is correct even where zIndex is unreliable.
  const window = [];
  for (let offset = WINDOW_SIZE - 1; offset >= 0; offset--) {
    const card = cards[index + offset];
    if (!card) continue;
    window.push(
      <SwipeCard
        key={card.data.id}
        card={card}
        stackPosition={offset}
        onSwipe={(direction) => handleSwipe(card, direction)}
        onPressDetails={onPressDetails ? () => onPressDetails(card) : undefined}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        screenWidth={width}
      />,
    );
  }

  return <View style={styles.deck}>{window}</View>;
}

const styles = StyleSheet.create({
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
