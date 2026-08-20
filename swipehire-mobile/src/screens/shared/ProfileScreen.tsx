import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CandidateCardContent } from '../../components/swipe/CandidateCardContent';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ListSkeleton } from '../../components/feedback/LoadingState';
import { Button } from '../../components/ui/Button';
import { SkillChip } from '../../components/ui/SkillChip';
import { useMyProfile } from '../../hooks/useProfile';
import { useAuth } from '../../store/auth';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import { formatSalaryRange, formatWorkMode, formatYears } from '../../utils/format';

/**
 * Profile — Frontend Spec §9, "optional, minimal" for the demo.
 *
 * For candidates it includes the spec's suggested "how recruiters see you" preview, rendered with
 * the actual card component rather than a mock-up of it. That makes the blind-first rule something
 * the user can see rather than be told: their own surname is missing from their own preview,
 * because it's missing from the payload a recruiter receives.
 */
export function ProfileScreen() {
  const { data, isPending, isError, refetch } = useMyProfile();
  const logout = useAuth((s) => s.logout);
  const email = useAuth((s) => s.user?.email);

  if (isPending) return <ListSkeleton rows={3} />;

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState title="Couldn't load your profile" onRetry={() => void refetch()} />
      </SafeAreaView>
    );
  }

  const isCandidate = data.role === 'candidate';
  const c = data.candidate;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[type('h3'), styles.title]}>{data.profile?.fullName ?? 'Your profile'}</Text>
          <Text style={[type('bodyM'), styles.subtitle]}>{email}</Text>
        </View>

        {isCandidate && c ? (
          <>
            <Section title="How recruiters see you">
              <Text style={[type('bodyM'), styles.note]}>
                Before you match, this is the whole of what they get. No surname, no contact details.
              </Text>
              <View style={styles.previewCard}>
                <CandidateCardContent
                  candidate={{
                    id: c.userId,
                    firstName: data.profile?.fullName?.split(' ')[0] ?? '',
                    lastInitial: (data.profile?.fullName?.split(' ').slice(-1)[0]?.[0] ?? '').toUpperCase(),
                    currentTitle: c.currentTitle,
                    headline: c.headline,
                    yearsExperience: c.yearsExperience,
                    locationCity: null,
                    preferredWorkMode: c.preferredWorkMode,
                    skills: c.skills,
                    // Nothing to match against outside a specific listing, so no chips are
                    // highlighted here — the preview shows the shape, not a score.
                    matchedSkills: [],
                    hasResume: c.resumeS3Key !== null,
                    matchScore: 0,
                  }}
                />
              </View>
            </Section>

            <Section title="Your details">
              <Row label="Experience" value={formatYears(c.yearsExperience)} />
              <Row label="Work mode" value={formatWorkMode(c.preferredWorkMode)} />
              <Row
                label="Expected salary"
                value={formatSalaryRange(c.expectedSalaryMin, c.expectedSalaryMax)}
              />
              <Row
                label="Notice period"
                value={c.noticePeriodDays != null ? `${c.noticePeriodDays} days` : 'Not stated'}
              />
              <Row label="Resume" value={c.resumeS3Key ? 'Uploaded' : 'Not uploaded'} />
            </Section>

            <Section title={`Skills (${c.skills.length})`}>
              <View style={styles.chips}>
                {c.skills.map((s) => (
                  <SkillChip key={s} label={s} />
                ))}
              </View>
            </Section>
          </>
        ) : (
          <Section title="Company">
            <Row label="Name" value={data.company?.name ?? 'Not set'} />
            <Row label="Industry" value={data.company?.industry ?? 'Not set'} />
            <Row label="Verified" value={data.company?.verified ? 'Yes' : 'No'} />
            <Text style={[type('caption'), styles.note]}>
              Auto-verified in this build. Production runs a work-email domain check and manual
              review before a listing can go live.
            </Text>
          </Section>
        )}

        <View style={styles.logout}>
          <Button label="Log out" variant="ghost" onPress={() => void logout()} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[type('h3'), styles.sectionTitle]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={[type('bodyM'), styles.rowLabel]}>{label}</Text>
      <Text style={[type('dataS'), styles.rowValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  content: { padding: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.xl },
  header: { gap: tokens.spacing.xs },
  title: { color: tokens.color.textPrimary },
  subtitle: { color: tokens.color.textSecondary },
  section: { gap: tokens.spacing.md },
  sectionTitle: { color: tokens.color.textPrimary },
  note: { color: tokens.color.textSecondary },
  previewCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: 'hidden',
    ...tokens.shadow.card,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  rowLabel: { color: tokens.color.textSecondary },
  rowValue: { color: tokens.color.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  logout: { marginTop: tokens.spacing.lg },
});
