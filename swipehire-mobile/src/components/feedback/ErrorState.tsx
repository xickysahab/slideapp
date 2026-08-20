import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import { Button } from '../ui/Button';

/**
 * ErrorState — Frontend Spec §4.1 / §13: always a message plus Retry.
 *
 * Demo Frontend Spec §6 singles this out as one of the two states worth building even for a demo:
 * if the client's own device hiccups mid-walkthrough, a blank white screen is far worse than a
 * card that says what happened and offers a way back.
 *
 * Copy follows the §1 tone rule — plain and specific, no apologising and no exclamation marks.
 */

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Inline sits inside a screen; fullscreen takes over. */
  variant?: 'inline' | 'fullscreen';
}

export function ErrorState({
  title = "That didn't load",
  message = 'Check your connection and try again.',
  onRetry,
  variant = 'fullscreen',
}: ErrorStateProps) {
  return (
    <View style={[styles.wrap, variant === 'inline' && styles.inline]} accessibilityRole="alert">
      <View style={styles.mark} />
      <Text style={[type('h3'), styles.title]}>{title}</Text>
      <Text style={[type('bodyM'), styles.message]}>{message}</Text>
      {onRetry && (
        <View style={styles.action}>
          <Button label="Retry" variant="secondary" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  inline: { flex: 0, paddingVertical: tokens.spacing.xxl },
  // A small warning-coloured square rather than an icon: §1 rules out emoji-style marks, and the
  // Phosphor set isn't wired up yet.
  mark: {
    width: tokens.spacing.lg,
    height: tokens.spacing.lg,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.warning,
    marginBottom: tokens.spacing.sm,
  },
  title: { color: tokens.color.textPrimary, textAlign: 'center' },
  message: { color: tokens.color.textSecondary, textAlign: 'center' },
  action: { marginTop: tokens.spacing.lg },
});
