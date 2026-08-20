import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { MatchSeal } from '../../components/swipe/MatchSeal';
import { Button } from '../../components/ui/Button';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * "It's a Match!" — Frontend Spec §7.2 and §9.
 *
 * The spec is unusually specific here, and worth honouring exactly: no confetti, no emoji burst.
 * A large Match Seal sweeps from 0% behind a scrim, and **the gold arc sweep is the celebration**.
 * A dating-app party moment is the single fastest way to undo the "trust dossier" positioning the
 * rest of the product is built on.
 *
 * The entrance is a fade and a rise, not a spring — §1 rules out overshoot bounce, and the seal's
 * own 900ms sweep is what the eye should be following anyway.
 */

export interface MatchCelebrationProps {
  visible: boolean;
  jobTitle: string;
  companyName: string | null;
  /** Name of the other party. Null for the candidate side, where it isn't known yet. */
  counterpartyName?: string | null;
  matchScore: number | null;
  onOpenChat: () => void;
  onKeepSwiping: () => void;
}

export function MatchCelebration({
  visible,
  jobTitle,
  companyName,
  counterpartyName,
  matchScore,
  onOpenChat,
  onKeepSwiping,
}: MatchCelebrationProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepSwiping}>
      <View style={styles.scrim}>
        <Animated.View entering={FadeIn.duration(tokens.motion.duration.base)} style={styles.content}>
          {/* Keyed on visibility so the sweep replays each time rather than only on first mount. */}
          {visible && <MatchSeal key="celebration" matchPercent={matchScore ?? 0} size="lg" animateIn />}

          <Animated.View
            entering={FadeInDown.delay(200).duration(tokens.motion.duration.slow)}
            style={styles.text}
          >
            <Text style={[type('displayL'), styles.headline]}>It&apos;s a match</Text>
            <Text style={[type('bodyL'), styles.detail]}>
              {counterpartyName
                ? `${counterpartyName} wants to talk about ${jobTitle}`
                : `You and ${companyName ?? 'the team'} both want to talk about ${jobTitle}`}
            </Text>
            <Text style={[type('bodyM'), styles.sub]}>Chat is open. No cold outreach either way.</Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(400).duration(tokens.motion.duration.slow)}
            style={styles.actions}
          >
            <Button label="Open chat" onPress={onOpenChat} fullWidth />
            <Button label="Keep swiping" variant="ghost" onPress={onKeepSwiping} fullWidth />
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Ink navy rather than black, and nearly opaque: the card underneath should read as frozen
  // behind it, not gone.
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 22, 41, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  content: { alignItems: 'center', gap: tokens.spacing.xl, width: '100%' },
  text: { alignItems: 'center', gap: tokens.spacing.sm },
  headline: { color: tokens.color.textInverse, textAlign: 'center' },
  detail: { color: tokens.color.textInverse, textAlign: 'center', opacity: 0.9 },
  sub: { color: tokens.color.textInverse, textAlign: 'center', opacity: 0.55 },
  actions: { width: '100%', gap: tokens.spacing.md, marginTop: tokens.spacing.lg },
});
