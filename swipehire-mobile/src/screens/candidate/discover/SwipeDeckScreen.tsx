import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeckSkeleton } from '../../../components/feedback/LoadingState';
import { ErrorState } from '../../../components/feedback/ErrorState';
import { SwipeDeck } from '../../../components/swipe/SwipeDeck';
import { discoverApi, swipeApi } from '../../../services/api/endpoints';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import type { JobCardData, SwipeCardData, SwipeDirection } from '../../../types';
import { MatchCelebration } from '../../shared/MatchCelebration';

/**
 * The candidate's job deck — Frontend Spec §9, candidate screen 10. The centrepiece.
 *
 * Swipes are fired but not awaited. The card has already flown off screen by the time the request
 * lands, and blocking the next card on a round trip is exactly what makes a deck feel sluggish —
 * Demo CLAUDE §2 names that feel as one of the two things not to compromise.
 *
 * One request per swipe. The full spec batches with a debounced flush; Demo Frontend Spec §5 drops
 * that, since there's no flush timing to get right at this volume.
 */

interface MatchMoment {
  matchId: string;
  jobTitle: string;
  companyName: string | null;
  matchScore: number | null;
}

export interface SwipeDeckScreenProps {
  onOpenMatch: (matchId: string) => void;
  onOpenDetails: (job: JobCardData) => void;
}

export function SwipeDeckScreen({ onOpenMatch, onOpenDetails }: SwipeDeckScreenProps) {
  const qc = useQueryClient();
  const [match, setMatch] = useState<MatchMoment | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['discover', 'jobs'],
    queryFn: () => discoverApi.jobs(),
    // The deck is a one-way street — cards leave it as they're swiped — so refetching on focus
    // would only ever re-fetch what's already been dealt with.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const handleSwipe = useCallback(
    (card: SwipeCardData, direction: SwipeDirection) => {
      if (card.kind !== 'job') return;
      const job = card.data;

      void swipeApi
        .onJob(job.id, direction)
        .then((result) => {
          if (!result.matched || !result.matchId) return;

          setMatch({
            matchId: result.matchId,
            jobTitle: job.title,
            companyName: job.companyName,
            matchScore: job.matchScore,
          });
          void qc.invalidateQueries({ queryKey: ['matches'] });
        })
        .catch(() => {
          // Swallowed on purpose. A failed swipe write is not worth interrupting the deck for, and
          // the card is already gone; the worst case is that it reappears next session.
        });
    },
    [qc],
  );

  if (isPending) return <DeckSkeleton />;

  if (isError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState
          title="Couldn't load your deck"
          message="Check your connection and try again."
          onRetry={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const cards: SwipeCardData[] = (data?.items ?? []).map((job) => ({ kind: 'job', data: job }));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={[type('h3'), styles.title]}>Discover</Text>
        <Text style={[type('dataS'), styles.count]}>
          {cards.length} {cards.length === 1 ? 'role' : 'roles'}
        </Text>
      </View>

      <SwipeDeck
        cards={cards}
        onSwipe={handleSwipe}
        onPressDetails={(card) => card.kind === 'job' && onOpenDetails(card.data)}
        emptyTitle="That's every role for now"
        emptyBody="You've seen everything matching your profile. New listings appear through the day."
        onRefresh={() => void refetch()}
      />

      <MatchCelebration
        visible={match !== null}
        jobTitle={match?.jobTitle ?? ''}
        companyName={match?.companyName ?? null}
        matchScore={match?.matchScore ?? null}
        onOpenChat={() => {
          const id = match?.matchId;
          setMatch(null);
          if (id) onOpenMatch(id);
        }}
        onKeepSwiping={() => setMatch(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  title: { color: tokens.color.textPrimary },
  count: { color: tokens.color.textSecondary },
});
