import { useState } from 'react';

import { Input } from '../../../components/ui/Input';
import { useUpdateProfile } from '../../../hooks/useProfile';
import { ApiError, NetworkError } from '../../../services/api/client';
import { SetupScaffold } from '../../onboarding/SetupScaffold';

/**
 * Candidate basics — Frontend Spec §9, candidate screen 5.
 *
 * Years of experience is collected here rather than parsed out of the resume. Architecture §6 is
 * explicit about that trade: parsing it reliably is hard, asking is trivial, and the number feeds
 * straight into the match score, so a wrong guess would be visible on every card.
 */

export interface CandidateBasicsScreenProps {
  onDone: () => void;
}

export function CandidateBasicsScreen({ onDone }: CandidateBasicsScreenProps) {
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [years, setYears] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const yearsValue = Number(years);
  const noticeValue = Number(notice);

  const yearsValid = years.length > 0 && Number.isInteger(yearsValue) && yearsValue >= 0 && yearsValue <= 60;
  const noticeValid = notice.length === 0 || (Number.isInteger(noticeValue) && noticeValue >= 0 && noticeValue <= 180);
  const canContinue = fullName.trim().length > 1 && yearsValid && noticeValid;

  async function submit() {
    setError(null);
    try {
      await update.mutateAsync({
        fullName: fullName.trim(),
        currentTitle: currentTitle.trim() || undefined,
        locationCity: locationCity.trim() || undefined,
        yearsExperience: yearsValue,
        noticePeriodDays: notice.length > 0 ? noticeValue : undefined,
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
      totalSteps={4}
      title="Tell us the basics"
      subtitle="This is what recruiters see alongside your match score."
      primaryLabel="Continue"
      onPrimary={submit}
      primaryDisabled={!canContinue}
      busy={update.isPending}
      error={error}
    >
      <Input
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Aditi Kulkarni"
        autoCapitalize="words"
        textContentType="name"
      />
      <Input
        label="Current or target role"
        value={currentTitle}
        onChangeText={setCurrentTitle}
        placeholder="Senior Backend Engineer"
        autoCapitalize="words"
      />
      <Input
        label="City"
        value={locationCity}
        onChangeText={setLocationCity}
        placeholder="Bengaluru"
        autoCapitalize="words"
      />
      <Input
        label="Years of experience"
        value={years}
        onChangeText={(v) => setYears(v.replace(/[^0-9]/g, ''))}
        placeholder="5"
        keyboardType="number-pad"
        error={years.length > 0 && !yearsValid ? 'Enter a number between 0 and 60' : null}
      />
      <Input
        label="Notice period (days)"
        value={notice}
        onChangeText={(v) => setNotice(v.replace(/[^0-9]/g, ''))}
        placeholder="60"
        keyboardType="number-pad"
        helper="Optional"
        error={!noticeValid ? 'Enter a number between 0 and 180' : null}
      />
    </SetupScaffold>
  );
}
