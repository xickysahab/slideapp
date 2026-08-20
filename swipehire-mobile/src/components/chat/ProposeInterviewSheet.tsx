import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { InterviewSlot } from '../../types';
import { Button } from '../ui/Button';

/**
 * Recruiter picks times to offer.
 *
 * Offers generated options rather than a date/time picker. The demo journey is "propose three
 * times, candidate picks one", and a full picker turns a five-second action into a fiddly one —
 * which is exactly the wrong thing to hand someone during a walkthrough. A real build would take
 * the picker; this build takes the flow.
 */

const MAX_SLOTS = 3;
const HOURS = [10, 14, 16];
const DAYS_AHEAD = 5;

function generateSlots(): InterviewSlot[] {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const slots: InterviewSlot[] = [];
  const now = new Date();

  for (let day = 1; day <= DAYS_AHEAD; day++) {
    const date = new Date(now);
    date.setDate(now.getDate() + day);

    // Weekends skipped — an interview slot on Sunday reads as a bug, not as flexibility.
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const hour of HOURS) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + 45 * 60_000);

      slots.push({ start: start.toISOString(), end: end.toISOString(), timezone });
    }
  }

  return slots;
}

function label(slot: InterviewSlot): string {
  const start = new Date(slot.start);
  const day = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} · ${time}`;
}

export interface ProposeInterviewSheetProps {
  visible: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (slots: InterviewSlot[]) => void;
}

export function ProposeInterviewSheet({
  visible,
  busy,
  error,
  onClose,
  onSubmit,
}: ProposeInterviewSheetProps) {
  // Regenerated per open so the options are always in the future, even if the app has been sitting
  // in the background — a slot in the past is rejected by the server.
  const options = useMemo(() => (visible ? generateSlots() : []), [visible]);
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(start: string) {
    setSelected((prev) =>
      prev.includes(start)
        ? prev.filter((s) => s !== start)
        : prev.length >= MAX_SLOTS
          ? prev
          : [...prev, start],
    );
  }

  function submit() {
    const chosen = options.filter((o) => selected.includes(o.start));
    if (chosen.length > 0) onSubmit(chosen);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={[type('h2'), styles.title]}>Propose interview times</Text>
            <Text style={[type('bodyM'), styles.subtitle]}>
              Pick up to {MAX_SLOTS}. They choose one, and it appears in the thread.
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.options}>
            {options.map((slot) => {
              const isSelected = selected.includes(slot.start);
              const atLimit = !isSelected && selected.length >= MAX_SLOTS;

              return (
                <Pressable
                  key={slot.start}
                  onPress={() => toggle(slot.start)}
                  disabled={atLimit || busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected, disabled: atLimit }}
                  accessibilityLabel={label(slot)}
                  style={[styles.option, isSelected && styles.optionSelected, atLimit && styles.optionDim]}
                >
                  <Text style={[type('bodyL'), isSelected ? styles.optionLabelSelected : styles.optionLabel]}>
                    {label(slot)}
                  </Text>
                  {isSelected && <Text style={[type('button'), styles.check]}>Selected</Text>}
                </Pressable>
              );
            })}
          </ScrollView>

          {error && <Text style={[type('bodyM'), styles.error]}>{error}</Text>}

          <View style={styles.actions}>
            <Button
              label={selected.length === 0 ? 'Pick at least one' : `Send ${selected.length} time${selected.length === 1 ? '' : 's'}`}
              onPress={submit}
              disabled={selected.length === 0}
              loading={busy}
              fullWidth
            />
            <Button label="Cancel" variant="ghost" onPress={onClose} disabled={busy} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15, 22, 41, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: tokens.color.background,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    paddingBottom: tokens.spacing.xl,
  },
  handleBar: { alignItems: 'center', paddingVertical: tokens.spacing.md },
  handle: { width: 36, height: 4, borderRadius: tokens.radius.pill, backgroundColor: tokens.color.borderStrong },
  header: { paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.xs },
  title: { color: tokens.color.textPrimary },
  subtitle: { color: tokens.color.textSecondary },
  options: { padding: tokens.spacing.lg, gap: tokens.spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  optionSelected: { borderColor: tokens.color.primary, backgroundColor: tokens.color.primaryTint },
  optionDim: { opacity: 0.4 },
  optionLabel: { color: tokens.color.textPrimary },
  optionLabelSelected: { color: tokens.color.primary },
  check: { color: tokens.color.primary },
  error: { color: tokens.color.error, paddingHorizontal: tokens.spacing.lg },
  actions: { paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
});
