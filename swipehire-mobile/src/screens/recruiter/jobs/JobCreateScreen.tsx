import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SkillChip } from '../../../components/ui/SkillChip';
import { ApiError, NetworkError } from '../../../services/api/client';
import { jobsApi } from '../../../services/api/endpoints';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import type { WorkMode } from '../../../types';

/**
 * Job creation — Frontend Spec §9 recruiter screens 4 and 5, simplified per Demo PRD §2 row 7 to a
 * single-step form with no multi-step guardrails.
 *
 * The required-skills picker (spec's separate screen 5) is folded in as the tech-stack field. The
 * spec's must-have/nice-to-have tiering is out of scope: the demo's match score weights every
 * required skill equally, so a tier the scorer ignores would be a control that does nothing.
 */

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

export interface JobCreateScreenProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function JobCreateScreen({ onCreated, onCancel }: JobCreateScreenProps) {
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [minLakh, setMinLakh] = useState('');
  const [maxLakh, setMaxLakh] = useState('');
  const [city, setCity] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | null>(null);
  const [minYears, setMinYears] = useState('');
  const [error, setError] = useState<string | null>(null);

  const min = Number(minLakh);
  const max = Number(maxLakh);
  const rangeValid = !(minLakh && maxLakh) || min <= max;
  // At least one skill, because the whole match score is computed against this list — a listing
  // without one would score every candidate identically.
  const canSubmit = title.trim().length >= 3 && skills.length > 0 && rangeValid;

  const create = useMutation({
    mutationFn: () =>
      jobsApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        techStack: skills,
        compMin: minLakh ? min * 100_000 : undefined,
        compMax: maxLakh ? max * 100_000 : undefined,
        locationCity: city.trim() || undefined,
        workMode: workMode ?? undefined,
        experienceMinYears: minYears ? Number(minYears) : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jobs', 'mine'] });
      onCreated();
    },
    onError: (err) => {
      if (err instanceof NetworkError) setError("Couldn't reach the server. Check your connection.");
      else if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Try again.');
    },
  });

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    if (!skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkills((prev) => [...prev, value]);
    }
    setSkillDraft('');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={12}>
          <Text style={[type('button'), styles.cancel]}>Cancel</Text>
        </Pressable>
        <Text style={[type('h3'), styles.headerTitle]}>New listing</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Input
            label="Role title"
            value={title}
            onChangeText={setTitle}
            placeholder="Senior Backend Engineer"
            autoCapitalize="words"
          />

          <Input
            label="What the job actually is"
            value={description}
            onChangeText={setDescription}
            placeholder="Own the payments ledger service, processing 40M transactions a day."
            helper="Optional, but it's the first thing candidates read"
            multiline
            numberOfLines={4}
          />

          <View>
            <Text style={[type('h3'), styles.sectionTitle]}>Required skills</Text>
            <Text style={[type('caption'), styles.sectionHint]}>
              Candidates are scored against these. At least one.
            </Text>

            {skills.length > 0 && (
              <View style={styles.chips}>
                {skills.map((skill) => (
                  <SkillChip
                    key={skill}
                    label={skill}
                    variant="matched"
                    onRemove={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                  />
                ))}
              </View>
            )}

            <View style={styles.addRow}>
              <View style={styles.addField}>
                <Input
                  label="Add a skill"
                  value={skillDraft}
                  onChangeText={setSkillDraft}
                  placeholder="Node.js"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
              </View>
              <Button label="Add" variant="secondary" onPress={addSkill} disabled={!skillDraft.trim()} />
            </View>
          </View>

          <View>
            <Text style={[type('h3'), styles.sectionTitle]}>Compensation</Text>
            <Text style={[type('caption'), styles.sectionHint]}>Annual, in lakhs. Optional.</Text>
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

          <Input
            label="City"
            value={city}
            onChangeText={setCity}
            placeholder="Bengaluru"
            autoCapitalize="words"
          />

          <View>
            <Text style={[type('h3'), styles.sectionTitle]}>Work mode</Text>
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
                    <Text style={[type('button'), selected ? styles.modeLabelSelected : styles.modeLabel]}>
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input
            label="Minimum years of experience"
            value={minYears}
            onChangeText={(v) => setMinYears(v.replace(/[^0-9]/g, ''))}
            placeholder="4"
            keyboardType="number-pad"
            helper="Optional. Candidates below this taper down rather than being excluded."
          />

          {error && <Text style={[type('bodyM'), styles.error]}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Post listing"
            onPress={() => create.mutate()}
            disabled={!canSubmit}
            loading={create.isPending}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  cancel: { color: tokens.color.primary },
  headerTitle: { color: tokens.color.textPrimary },
  headerSpacer: { width: 52 },
  form: { padding: tokens.spacing.lg, gap: tokens.spacing.xl, paddingBottom: tokens.spacing.xxl },
  sectionTitle: { color: tokens.color.textPrimary },
  sectionHint: { color: tokens.color.textSecondary, marginTop: tokens.spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginTop: tokens.spacing.md },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spacing.md, marginTop: tokens.spacing.md },
  addField: { flex: 1 },
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
  error: { color: tokens.color.error },
  footer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
});
