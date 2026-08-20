import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '../../../components/feedback/ErrorState';
import { DeckSkeleton } from '../../../components/feedback/LoadingState';
import { SwipeDeck } from '../../../components/swipe/SwipeDeck';
import { discoverApi, swipeApi } from '../../../services/api/endpoints';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import type { CandidateCardData, Job, SwipeCardData, SwipeDirection } from '../../../types';
import { MatchCelebration } from '../../shared/MatchCelebration';

/**
 * The recruiter's candidate deck, scoped to one listing — Frontend Spec §9, recruiter screen 6.
 *
 * Scoped is the important part. A candidate only means something relative to a role, the match
 * score is computed against that role's stack, and swipes are recorded per listing — so passing on
 * someone here doesn't remove them from another role's deck.
 */

interface MatchMoment {
  matchId: string;
  candidateName: string;
  matchScore: number | null;
}

export interface CandidateDeckScreenProps {
  job: Job;
  onBack: () => void;
  onOpenMatch: (matchId: string) => void;
  onOpenDetails: (candidate: CandidateCardData) => void;
}

export function CandidateDeckScreen({
  job,
  onBack,
  onOpenMatch,
  onOpenDetails,
}: CandidateDeckScreenProps) {
  const qc = useQueryClient();
  const [match, setMatch] = useState<MatchMoment | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['discover', 'candidates', job.id],
    queryFn: () => discoverApi.candidates(job.id),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const handleSwipe = useCallback(
    (card: SwipeCardData, direction: SwipeDirection) => {
      if (card.kind !== 'candidate') return;
      const candidate = card.data;

      void swipeApi
        .onCandidate(candidate.id, job.id, direction)
        .then((result) => {
          if (!result.matched || !result.matchId) return;

          setMatch({
            matchId: result.matchId,
            // Still the blind-first name at this moment — the full name arrives with the match.
            candidateName: `${candidate.firstName} ${candidate.lastInitial}.`,
            matchScore: candidate.matchScore,
          });
          void qc.invalidateQueries({ queryKey: ['matches'] });
        })
        .catch(() => {
          // Same reasoning as the candidate deck: the card is already gone, and interrupting the
          // deck for a failed write costs more than the write is worth.
        });
    },
    [job.id, qc],
  );

  const header = (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
        <Text style={[type('button'), styles.back]}>Back</Text>
      </Pressable>

      <View style={styles.headerTitle}>
        <Text style={[type('h3'), styles.jobTitle]} numberOfLines={1}>
          {job.title}
        </Text>
        <Text style={[type('caption'), styles.jobSub]} numberOfLines={1}>
          Ranked against this listing
        </Text>
      </View>
    </View>
  );

  if (isPending) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <DeckSkeleton />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <ErrorState title="Couldn't load candidates" onRetry={() => void refetch()} />
      </SafeAreaView>
    );
  }

  const cards: SwipeCardData[] = (data?.items ?? []).map((candidate) => ({
    kind: 'candidate',
    data: candidate,
  }));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {header}

      <SwipeDeck
        cards={cards}
        onSwipe={handleSwipe}
        onPressDetails={(card) => card.kind === 'candidate' && onOpenDetails(card.data)}
        emptyTitle="You've seen everyone"
        emptyBody="Every candidate matching this listing has been reviewed. New profiles appear as people join."
      />

      <MatchCelebration
        visible={match !== null}
        jobTitle={job.title}
        companyName={null}
        counterpartyName={match?.candidateName ?? null}
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
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  back: { color: tokens.color.primary },
  headerTitle: { flex: 1 },
  jobTitle: { color: tokens.color.textPrimary },
  jobSub: { color: tokens.color.textSecondary },
});
