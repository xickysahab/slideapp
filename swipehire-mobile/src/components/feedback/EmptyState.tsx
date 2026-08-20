import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import { Button } from '../ui/Button';

/**
 * EmptyState — Frontend Spec §4.1 / §13.
 *
 * Copy follows the §1 tone rule: plain, active, specific, no exclamation marks and no forced
 * cheerfulness. An empty deck is a normal state, not an apology.
 *
 * The illustration slot from §13 is not wired up yet (no illustration assets); the headline and
 * body carry it for now, which is enough to never show a blank screen. Full treatment is DEMO-18.
 */

export interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={[type('h2'), styles.title]}>{title}</Text>
      {body ? <Text style={[type('bodyM'), styles.body]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
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
  title: { color: tokens.color.textPrimary, textAlign: 'center' },
  body: { color: tokens.color.textSecondary, textAlign: 'center' },
  action: { marginTop: tokens.spacing.lg },
});
