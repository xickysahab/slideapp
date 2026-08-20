import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SwipeDeck } from './src/components/swipe/SwipeDeck';
import { useAppFonts } from './src/hooks/useAppFonts';
import { MOCK_CANDIDATE_DECK, MOCK_JOB_DECK } from './src/services/api/mockDeck';
import { tokens } from './src/theme/tokens';
import { type } from './src/theme/typography';
import type { SwipeCardData, SwipeDirection } from './src/types';

/**
 * DEMO-09 harness.
 *
 * A scratch screen for building and checking the swipe deck against static data, with a toggle
 * between the candidate-facing job deck and the recruiter-facing candidate deck so both card
 * layouts can be exercised side by side. Replaced by RootNavigator once Phase 1 lands — nothing
 * here is a screen from Frontend Spec §9.
 */

type DeckRole = 'candidate' | 'recruiter';

export default function App() {
  const { fontsLoaded, fontError } = useAppFonts();
  const [role, setRole] = useState<DeckRole>('candidate');
  const [lastAction, setLastAction] = useState<string | null>(null);

  const cards = useMemo(
    () => (role === 'candidate' ? MOCK_JOB_DECK : MOCK_CANDIDATE_DECK),
    [role],
  );

  const handleSwipe = useCallback((card: SwipeCardData, direction: SwipeDirection) => {
    const name =
      card.kind === 'job' ? card.data.title : `${card.data.firstName} ${card.data.lastInitial}.`;
    setLastAction(`${direction === 'right' ? 'Shortlisted' : 'Passed'} · ${name}`);
  }, []);

  // Nothing renders text before the three type roles are available — a flash of system font
  // followed by a swap to Fraunces is the kind of detail that reads as unfinished.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.bootWrap}>
        <ActivityIndicator color={tokens.color.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[type('h3'), styles.wordmark]}>SwipeHire</Text>

          <View style={styles.toggle}>
            {(['candidate', 'recruiter'] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setRole(r);
                  setLastAction(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: role === r }}
                style={[styles.toggleItem, role === r && styles.toggleItemActive]}
              >
                <Text
                  style={[
                    type('caption'),
                    role === r ? styles.toggleLabelActive : styles.toggleLabel,
                  ]}
                >
                  {r === 'candidate' ? 'Jobs' : 'Candidates'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Remounts the deck on role change so the rolling window restarts from the first card. */}
        <SwipeDeck
          key={role}
          cards={cards}
          onSwipe={handleSwipe}
          emptyTitle="That's everyone for now"
          emptyBody={
            role === 'candidate'
              ? 'You have seen every open role matching your profile.'
              : 'You have reviewed every candidate for this listing.'
          }
        />

        <View style={styles.statusBar}>
          <Text style={[type('dataS'), styles.statusText]} numberOfLines={1}>
            {lastAction ?? 'DEMO-09 · drag a card, or use the buttons'}
          </Text>
        </View>

        <StatusBar style="light" />
      </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.background },
  bootWrap: {
    flex: 1,
    backgroundColor: tokens.color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.color.backgroundChrome,
  },
  wordmark: { color: tokens.color.textInverse },
  toggle: {
    flexDirection: 'row',
    backgroundColor: tokens.color.surfaceAlt + '22',
    borderRadius: tokens.radius.sm,
    padding: 2,
  },
  toggleItem: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm - 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  toggleItemActive: { backgroundColor: tokens.color.primary },
  toggleLabel: { color: tokens.color.textInverse, opacity: 0.55 },
  toggleLabelActive: { color: tokens.color.textInverse },
  statusBar: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  statusText: { color: tokens.color.textSecondary },
});
