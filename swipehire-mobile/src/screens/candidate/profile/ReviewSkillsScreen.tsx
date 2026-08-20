import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SkillChip } from '../../../components/ui/SkillChip';
import { useUpdateProfile } from '../../../hooks/useProfile';
import { ApiError, NetworkError } from '../../../services/api/client';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import { SetupScaffold } from '../../onboarding/SetupScaffold';

/**
 * Review and edit the parsed skills — Frontend Spec §9, candidate screen 8.
 *
 * Demo Frontend Spec §2 calls this one out as important to keep, and it is: the parser genuinely
 * ran, so this screen is where the user sees what a real system extracted and gets to correct it.
 * That's the difference between a demo that looks automated and one that looks honest.
 *
 * Removal has to work, not just addition. The API replaces the skill list wholesale rather than
 * merging for exactly this reason (docs/BACKEND.md §3.2).
 */

export interface ReviewSkillsScreenProps {
  /** What the parser found. Empty when the user skipped the upload. */
  initialSkills: string[];
  onDone: () => void;
  /** See ResumeUploadScreen — 'update' is this screen reached from Profile, not from setup. */
  mode?: 'onboarding' | 'update';
}

export function ReviewSkillsScreen({
  initialSkills,
  onDone,
  mode = 'onboarding',
}: ReviewSkillsScreenProps) {
  const isUpdate = mode === 'update';
  const update = useUpdateProfile();

  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parsedCount = initialSkills.length;

  function addSkill() {
    const value = draft.trim();
    if (!value) return;

    // Case-insensitive dedupe: "node.js" and "Node.js" are the same skill, and two chips saying
    // almost the same thing looks like a bug.
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }

    setSkills((prev) => [...prev, value]);
    setDraft('');
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }

  async function submit() {
    setError(null);
    try {
      await update.mutateAsync({ skills });
      onDone();
    } catch (err) {
      if (err instanceof NetworkError) setError("Couldn't reach the server. Check your connection.");
      else if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Try again.');
    }
  }

  return (
    <SetupScaffold
      step={isUpdate ? 1 : 3}
      totalSteps={isUpdate ? 1 : 4}
      title={parsedCount > 0 ? 'Check what we found' : 'Add your skills'}
      subtitle={
        parsedCount > 0
          ? `We read ${parsedCount} skill${parsedCount === 1 ? '' : 's'} off your resume. Remove anything wrong, add anything missing.`
          : 'These decide which roles you match. Add the ones you actually work with.'
      }
      primaryLabel={isUpdate ? 'Save skills' : 'Continue'}
      onPrimary={submit}
      primaryDisabled={skills.length === 0}
      busy={update.isPending}
      error={error}
    >
      <View style={styles.chipArea}>
        {skills.length === 0 ? (
          <Text style={[type('bodyM'), styles.empty]}>
            No skills yet. Add at least one to continue.
          </Text>
        ) : (
          <View style={styles.chips}>
            {skills.map((skill) => (
              <SkillChip
                key={skill}
                label={skill}
                variant="matched"
                onRemove={() => removeSkill(skill)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.addRow}>
        <View style={styles.addField}>
          <Input
            label="Add a skill"
            value={draft}
            onChangeText={setDraft}
            placeholder="Kubernetes"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={addSkill}
            returnKeyType="done"
          />
        </View>
        <Button label="Add" variant="secondary" onPress={addSkill} disabled={!draft.trim()} />
      </View>
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  chipArea: { minHeight: 120 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  empty: { color: tokens.color.textSecondary },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spacing.md },
  addField: { flex: 1 },
});
