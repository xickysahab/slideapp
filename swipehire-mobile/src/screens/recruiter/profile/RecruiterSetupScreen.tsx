import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Input } from '../../../components/ui/Input';
import { useUpdateProfile, useUpsertCompany } from '../../../hooks/useProfile';
import { ApiError, NetworkError } from '../../../services/api/client';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import { SetupScaffold } from '../../onboarding/SetupScaffold';

/**
 * Recruiter setup — Frontend Spec §9, recruiter screen 2, trimmed per Demo Frontend Spec §2 to
 * "Name, logo, industry — skip size/website".
 *
 * One screen rather than the spec's separate profile and company steps: it's three fields, and the
 * recruiter's actual goal is the dashboard behind it.
 *
 * The verification step (spec's recruiter screen 3) doesn't exist — every recruiter is auto-verified
 * for this build, and the badge renders regardless (Demo PRD §2 rows 4 and 20). That's stated here
 * rather than hidden, so nobody wonders where the step went.
 */

export interface RecruiterSetupScreenProps {
  onDone: () => void;
}

export function RecruiterSetupScreen({ onDone }: RecruiterSetupScreenProps) {
  const updateProfile = useUpdateProfile();
  const upsertCompany = useUpsertCompany();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState<string | null>(null);

  const busy = updateProfile.isPending || upsertCompany.isPending;
  const canContinue = fullName.trim().length > 1 && companyName.trim().length > 1;

  async function submit() {
    setError(null);
    try {
      // Profile first: the company call needs a recruiter who exists, and doing them in this order
      // means a failure halfway leaves the name saved rather than a company with no owner named.
      await updateProfile.mutateAsync({ fullName: fullName.trim() });
      await upsertCompany.mutateAsync({
        name: companyName.trim(),
        industry: industry.trim() || undefined,
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
      step={1}
      totalSteps={1}
      title="Set up your company"
      subtitle="Candidates see this on every listing you post."
      primaryLabel="Continue to your listings"
      onPrimary={submit}
      primaryDisabled={!canContinue}
      busy={busy}
      error={error}
    >
      <Input
        label="Your name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Rahul Mehta"
        autoCapitalize="words"
        textContentType="name"
      />
      <Input
        label="Company name"
        value={companyName}
        onChangeText={setCompanyName}
        placeholder="Razorpay"
        autoCapitalize="words"
        textContentType="organizationName"
      />
      <Input
        label="Industry"
        value={industry}
        onChangeText={setIndustry}
        placeholder="Fintech"
        autoCapitalize="words"
        helper="Optional"
      />

      <View style={styles.note}>
        <View style={styles.noteMark} />
        <Text style={[type('caption'), styles.noteText]}>
          Companies are auto-verified in this build. In production this is where the work-email
          domain check and manual review would sit.
        </Text>
      </View>
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    backgroundColor: tokens.color.secondaryTint,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
  },
  noteMark: {
    width: tokens.spacing.sm,
    height: tokens.spacing.sm,
    borderRadius: 2,
    backgroundColor: tokens.color.secondary,
    marginTop: tokens.spacing.xs,
  },
  noteText: { color: tokens.color.textPrimary, flex: 1 },
});
