import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * ChatBubble — Frontend Spec §4.1.
 *
 * `sent` fills with primary and uses inverse text; `received` sits on surface.alt; `system` is a
 * centred pill for events the app narrates rather than either party saying.
 */

export type ChatBubbleVariant = 'sent' | 'received' | 'system';

export interface ChatBubbleProps {
  content: string;
  variant: ChatBubbleVariant;
  timestamp?: string;
  /** Shown under the last sent message only, so the column isn't a wall of "Read". */
  readReceipt?: boolean;
}

function ChatBubbleComponent({ content, variant, timestamp, readReceipt }: ChatBubbleProps) {
  if (variant === 'system') {
    return (
      <View style={styles.systemWrap}>
        <Text style={[type('caption'), styles.systemText]}>{content}</Text>
      </View>
    );
  }

  const sent = variant === 'sent';

  return (
    <View style={[styles.row, sent ? styles.rowSent : styles.rowReceived]}>
      <View style={[styles.bubble, sent ? styles.bubbleSent : styles.bubbleReceived]}>
        <Text style={[type('bodyL'), sent ? styles.textSent : styles.textReceived]}>{content}</Text>
      </View>

      {(timestamp || readReceipt) && (
        <Text style={[type('dataS'), styles.meta]}>
          {timestamp}
          {readReceipt ? ' · Read' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '82%', gap: tokens.spacing.xs, marginVertical: tokens.spacing.xs },
  rowSent: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowReceived: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
  },
  bubbleSent: {
    backgroundColor: tokens.color.primary,
    // Squared corner on the side it comes from, so the two columns read as two speakers.
    borderBottomRightRadius: tokens.radius.sm,
  },
  bubbleReceived: {
    backgroundColor: tokens.color.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderBottomLeftRadius: tokens.radius.sm,
  },
  textSent: { color: tokens.color.textInverse },
  textReceived: { color: tokens.color.textPrimary },
  meta: { color: tokens.color.textSecondary, paddingHorizontal: tokens.spacing.xs },
  systemWrap: {
    alignSelf: 'center',
    backgroundColor: tokens.color.surfaceAlt,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    marginVertical: tokens.spacing.md,
  },
  systemText: { color: tokens.color.textSecondary },
});

export const ChatBubble = memo(ChatBubbleComponent);
