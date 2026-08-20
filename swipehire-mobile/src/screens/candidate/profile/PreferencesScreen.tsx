import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '../../../components/ui/Input';
import { useUpdateProfile } from '../../../hooks/useProfile';
import { ApiError, NetworkError } from '../../../services/api/client';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import type { WorkMode } from '../../../types';
import { SetupScaffold } from '../../onboarding/SetupScaffold';

/**
 * Preferences — Frontend Spec §9, candidate screen 9, trimmed per Demo Frontend Spec §2 to
 * "salary band + remote/hybrid/onsite only — skip target industries".
 *
 * Salary is entered in lakhs because that's how the Indian tech market states it, and how every
 * card renders it. Asking for 1800000 and displaying ₹18L would be two different languages for the
 * same number.
 */

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

export interface PreferencesScreenProps {
  onDone: () => void;
}

export function PreferencesScreen({ onDone }: PreferencesScreenProps) {
  const update = useUpdateProfile();

  const [minLakh, setMinLakh] = useState('');
  const [maxLakh, setMaxLakh] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const min = Number(minLakh);
  const max = Number(maxLakh);
  const bothGiven = minLakh.length > 0 && maxLakh.length > 0;
  const rangeValid = !bothGiven || min <= max;

  async function submit() {
    setError(null);
    try {
      await update.mutateAsync({
        // Lakhs in, rupees out — the API stores annual rupees.
        expectedSalaryMin: minLakh.length > 0 ? min * 100_000 : undefined,
        expectedSalaryMax: maxLakh.length > 0 ? max * 100_000 : undefined,
        preferredWorkMode: workMode ?? undefined,
      });
      onDone();
    } catch (err) {
      if (err instanceof NetworkError) setError("Couldn't reach the server. Check your connection.");
      else if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Try again.');
    }
  }

  return (
    <SetupScaffold
      step={4}
      totalSteps={4}
      title="What are you looking for?"
      subtitle="All optional — it just sharpens what lands in your deck."
      primaryLabel="Start swiping"
      onPrimary={submit}
      primaryDisabled={!rangeValid}
      busy={update.isPending}
      error={error}
    >
      <View>
        <Text style={[type('h3'), styles.sectionTitle]}>Expected salary</Text>
        <Text style={[type('caption'), styles.sectionHint]}>Annual, in lakhs</Text>

        <View style={styles.rangeRow}>
          <View style={styles.rangeField}>
            <Input
              label="From"
              value={minLakh}
              onChangeText={(v) => setMinLakh(v.replace(/[^0-9]/g, ''))}
              placeholder="18"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.rangeField}>
            <Input
              label="To"
              value={maxLakh}
              onChangeText={(v) => setMaxLakh(v.replace(/[^0-9]/g, ''))}
              placeholder="28"
              keyboardType="number-pad"
              error={!rangeValid ? 'Must be at least the lower figure' : null}
            />
          </View>
        </View>
      </View>

      <View>
        <Text style={[type('h3'), styles.sectionTitle]}>Preferred work mode</Text>

        <View style={styles.modes}>
          {WORK_MODES.map((mode) => {
            const selected = workMode === mode.value;
            return (
              <Pressable
                key={mode.value}
                onPress={() => setWorkMode(selected ? null : mode.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={mode.label}
                style={[styles.mode, selected && styles.modeSelected]}
              >
                <Text
                  style={[type('button'), selected ? styles.modeLabelSelected : styles.modeLabel]}
                >
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: tokens.color.textPrimary },
  sectionHint: { color: tokens.color.textSecondary, marginTop: tokens.spacing.xs },
  rangeRow: { flexDirection: 'row', gap: tokens.spacing.md, marginTop: tokens.spacing.md },
  rangeField: { flex: 1 },
  modes: { flexDirection: 'row', gap: tokens.spacing.md, marginTop: tokens.spacing.md },
  mode: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  modeSelected: { borderColor: tokens.color.primary, backgroundColor: tokens.color.primaryTint },
  modeLabel: { color: tokens.color.textSecondary },
  modeLabelSelected: { color: tokens.color.primary },
});
