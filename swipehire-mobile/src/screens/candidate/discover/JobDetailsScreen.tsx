import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchSeal } from '../../../components/swipe/MatchSeal';
import { SkillChip } from '../../../components/ui/SkillChip';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import type { JobCardData } from '../../../types';
import {
  formatExperience,
  formatRelativeTime,
  formatSalaryRange,
  formatWorkMode,
  rankSkills,
} from '../../../utils/format';

/**
 * The full listing behind a card — Frontend Spec §9, candidate screen 11.
 *
 * Reached by tapping the card rather than swiping it, so it deliberately offers no Pass/Shortlist
 * buttons: the decision belongs on the deck, and duplicating it here would mean two places to keep
 * in step. Reading the detail and then going back leaves the card exactly where it was.
 */

export interface JobDetailsScreenProps {
  job: JobCardData;
  onBack: () => void;
}

export function JobDetailsScreen({ job, onBack }: JobDetailsScreenProps) {
  const { visible, overflow } = rankSkills(job.techStack, job.matchedSkills, job.techStack.length);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Text style={[type('button'), styles.back]}>Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={[type('h1'), styles.title]}>{job.title}</Text>
            <Text style={[type('bodyL'), styles.company]}>
              {job.companyName}
              {job.companyVerified ? ' · Verified' : ''}
            </Text>
          </View>
          <MatchSeal matchPercent={job.matchScore} size="lg" animateIn />
        </View>

        <View style={styles.facts}>
          <Fact label="Salary" value={formatSalaryRange(job.compMin, job.compMax)} />
          <Fact label="Work mode" value={formatWorkMode(job.workMode)} />
          <Fact label="Location" value={job.locationCity ?? 'Not stated'} />
          <Fact label="Experience" value={formatExperience(job.experienceMinYears)} />
          <Fact label="Posted" value={formatRelativeTime(job.postedAt)} />
        </View>

        <Section title={`What they're asking for (${job.techStack.length})`}>
          <Text style={[type('bodyM'), styles.note]}>
            {job.matchedSkills.length} of these {job.matchedSkills.length === 1 ? 'is' : 'are'} on
            your profile — that&apos;s most of your {job.matchScore}% score.
          </Text>
          <View style={styles.chips}>
            {visible.map((s) => (
              <SkillChip key={s.label} label={s.label} variant={s.matched ? 'matched' : 'default'} />
            ))}
            {overflow > 0 && <SkillChip label={`+${overflow}`} />}
          </View>
        </Section>

        {job.description && (
          <Section title="About the role">
            <Text style={[type('bodyL'), styles.description]}>{job.description}</Text>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[type('h2'), styles.sectionTitle]}>{title}</Text>
      {children}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={[type('caption'), styles.factLabel]}>{label}</Text>
      <Text style={[type('dataS'), styles.factValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  header: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.md },
  back: { color: tokens.color.primary },
  content: { padding: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.lg },
  titleText: { flex: 1, gap: tokens.spacing.xs },
  title: { color: tokens.color.textPrimary },
  company: { color: tokens.color.textSecondary },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.lg,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.spacing.lg,
  },
  fact: { minWidth: '40%', gap: 2 },
  factLabel: { color: tokens.color.textSecondary },
  factValue: { color: tokens.color.textPrimary },
  section: { gap: tokens.spacing.md },
  sectionTitle: { color: tokens.color.textPrimary },
  note: { color: tokens.color.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  description: { color: tokens.color.textPrimary },
});
