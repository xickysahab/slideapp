import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { Interview, InterviewSlot, UserRole } from '../../types';

/**
 * The interview proposal, rendered inline in the chat thread — Frontend Spec §9, and called out in
 * Demo Frontend Spec §2 as central to the demo journey.
 *
 * It lives in the conversation rather than on its own screen because that's where the decision
 * actually happens; bouncing to a scheduling screen would break the thread it belongs to.
 *
 * A candidate picks by tapping a slot. The index is what gets sent — the server checks the choice
 * against what was actually offered, so the client can't confirm a time nobody proposed.
 */

export interface InterviewSlotCardProps {
  interview: Interview;
  role: UserRole;
  onAccept: (slotIndex: number) => void;
  busy?: boolean;
}

function formatSlot(slot: InterviewSlot): { day: string; time: string } {
  const start = new Date(slot.start);
  const end = new Date(slot.end);

  const day = start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

  return { day, time: `${fmt(start)} – ${fmt(end)}` };
}

export function InterviewSlotCard({ interview, role, onAccept, busy }: InterviewSlotCardProps) {
  const confirmed = interview.status === 'confirmed' && interview.confirmedSlot;

  if (confirmed) {
    const { day, time } = formatSlot(interview.confirmedSlot!);
    return (
      <View style={[styles.card, styles.cardConfirmed]}>
        <View style={styles.headerRow}>
          <View style={styles.confirmedMark} />
          <Text style={[type('caption'), styles.eyebrow]}>Interview scheduled</Text>
        </View>
        <Text style={[type('h3'), styles.confirmedDay]}>{day}</Text>
        <Text style={[type('dataL'), styles.confirmedTime]}>{time}</Text>
        <Text style={[type('caption'), styles.footnote]}>
          {interview.confirmedSlot!.timezone}
        </Text>
      </View>
    );
  }

  const canAccept = role === 'candidate';

  return (
    <View style={styles.card}>
      <Text style={[type('caption'), styles.eyebrow]}>
        {canAccept ? 'Pick a time that works' : 'Waiting on the candidate'}
      </Text>

      <View style={styles.slots}>
        {interview.proposedSlots.map((slot, index) => {
          const { day, time } = formatSlot(slot);

          return (
            <Pressable
              key={slot.start}
              onPress={() => canAccept && !busy && onAccept(index)}
              disabled={!canAccept || busy}
              accessibilityRole="button"
              accessibilityLabel={`${day}, ${time}`}
              accessibilityHint={canAccept ? 'Confirms this interview time' : undefined}
              style={({ pressed }) => [
                styles.slot,
                pressed && canAccept && styles.slotPressed,
                !canAccept && styles.slotInert,
              ]}
            >
              <View style={styles.slotText}>
                <Text style={[type('bodyL'), styles.slotDay]}>{day}</Text>
                <Text style={[type('dataS'), styles.slotTime]}>{time}</Text>
              </View>
              {canAccept && <Text style={[type('button'), styles.pick]}>Pick</Text>}
            </Pressable>
          );
        })}
      </View>

      {!canAccept && (
        <Text style={[type('caption'), styles.footnote]}>
          They&apos;ll confirm one of these. You&apos;ll see it here.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    marginVertical: tokens.spacing.md,
  },
  // Gold border for the confirmed state: the one place the accent is allowed as a marker, and it
  // makes the scheduled interview the most findable thing in the thread.
  cardConfirmed: { borderColor: tokens.color.secondary, backgroundColor: tokens.color.secondaryTint },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  confirmedMark: {
    width: tokens.spacing.sm,
    height: tokens.spacing.sm,
    borderRadius: 2,
    backgroundColor: tokens.color.success,
  },
  eyebrow: { color: tokens.color.textSecondary },
  confirmedDay: { color: tokens.color.textPrimary },
  confirmedTime: { color: tokens.color.textPrimary },
  footnote: { color: tokens.color.textSecondary },
  slots: { gap: tokens.spacing.sm },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surfaceAlt,
  },
  slotPressed: { borderColor: tokens.color.primary, backgroundColor: tokens.color.primaryTint },
  slotInert: { opacity: 0.7 },
  slotText: { gap: 2 },
  slotDay: { color: tokens.color.textPrimary },
  slotTime: { color: tokens.color.textSecondary },
  pick: { color: tokens.color.primary },
});
