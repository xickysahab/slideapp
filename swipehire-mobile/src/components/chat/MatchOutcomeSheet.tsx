import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/**
 * The Outcome step — the tail of the client's journey diagram, and the only place a match ends.
 *
 * Recruiter-only, because it is a hiring decision. Two consequences worth being explicit about in
 * the UI, since neither is reversible:
 *
 *  - Hired closes the listing to everyone, not just this candidate
 *  - Not selected ends the conversation, with an optional note the candidate will read
 */

export interface MatchOutcomeSheetProps {
  visible: boolean;
  candidateName: string;
  jobTitle: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (outcome: 'hired' | 'not_selected', note?: string) => void;
}

export function MatchOutcomeSheet({
  visible,
  candidateName,
  jobTitle,
  busy,
  error,
  onClose,
  onSubmit,
}: MatchOutcomeSheetProps) {
  const [choice, setChoice] = useState<'hired' | 'not_selected' | null>(null);
  const [note, setNote] = useState('');

  function close() {
    setChoice(null);
    setNote('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={[type('h2'), styles.title]}>How did it go?</Text>
            <Text style={[type('bodyM'), styles.subtitle]}>
              {candidateName} · {jobTitle}
            </Text>
          </View>

          <View style={styles.choices}>
            <Choice
              label="Hired"
              detail="Closes the listing and archives this match."
              selected={choice === 'hired'}
              onPress={() => setChoice('hired')}
            />
            <Choice
              label="Not selected"
              detail="Ends the conversation. You can leave a short note."
              selected={choice === 'not_selected'}
              onPress={() => setChoice('not_selected')}
            />
          </View>

          {choice === 'not_selected' && (
            <View style={styles.noteField}>
              <Input
                label="Feedback"
                value={note}
                onChangeText={setNote}
                placeholder="Strong on SQL — we needed more depth on Spark."
                helper="Optional. They'll see this."
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {error && <Text style={[type('bodyM'), styles.error]}>{error}</Text>}

          <View style={styles.actions}>
            <Button
              label={choice === 'hired' ? 'Mark as hired' : 'Close this match'}
              variant={choice === 'hired' ? 'primary' : 'destructive'}
              onPress={() => choice && onSubmit(choice, note.trim() || undefined)}
              disabled={!choice}
              loading={busy}
              fullWidth
            />
            <Button label="Not yet" variant="ghost" onPress={close} disabled={busy} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Choice({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[type('h3'), selected ? styles.choiceLabelSelected : styles.choiceLabel]}>
        {label}
      </Text>
      <Text style={[type('bodyM'), styles.choiceDetail]}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15, 22, 41, 0.45)', justifyContent: 'flex-end' },
  sheet: {
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
  choices: { padding: tokens.spacing.lg, gap: tokens.spacing.md },
  choice: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    gap: tokens.spacing.xs,
  },
  choiceSelected: { borderColor: tokens.color.primary, backgroundColor: tokens.color.primaryTint },
  choiceLabel: { color: tokens.color.textPrimary },
  choiceLabelSelected: { color: tokens.color.primary },
  choiceDetail: { color: tokens.color.textSecondary },
  noteField: { paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.md },
  error: { color: tokens.color.error, paddingHorizontal: tokens.spacing.lg },
  actions: { paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.sm },
});
