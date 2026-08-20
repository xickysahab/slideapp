import { StyleSheet, Text, View } from 'react-native';

import { MatchSeal } from '../../components/swipe/MatchSeal';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * Splash — Frontend Spec §9, candidate screen 1.
 *
 * Shown while the stored session is checked on launch. Uses the Match Seal's own arc sweep as the
 * loader rather than a spinner: it's the product's signature element, it already animates on mount,
 * and it means the first thing anyone sees is the thing the product is built around.
 */
export function SplashScreen() {
  return (
    <View style={styles.screen}>
      <MatchSeal matchPercent={100} size="lg" animateIn />
      <Text style={[type('displayL'), styles.wordmark]}>SwipeHire</Text>
      <Text style={[type('bodyM'), styles.tagline]}>Mutual intent, not mass applications.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.lg,
  },
  wordmark: { color: tokens.color.textPrimary, marginTop: tokens.spacing.lg },
  tagline: { color: tokens.color.textSecondary },
});
