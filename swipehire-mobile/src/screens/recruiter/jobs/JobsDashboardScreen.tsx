import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../../../components/feedback/EmptyState';
import { ErrorState } from '../../../components/feedback/ErrorState';
import { ListSkeleton } from '../../../components/feedback/LoadingState';
import { Button } from '../../../components/ui/Button';
import { SkillChip } from '../../../components/ui/SkillChip';
import { jobsApi } from '../../../services/api/endpoints';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import type { Job } from '../../../types';
import { formatRelativeTime, formatSalaryRange, formatWorkMode } from '../../../utils/format';

/**
 * The recruiter's landing screen: their own listings, and the way into each one's candidate deck.
 *
 * Frontend Spec §2 marks job management optional for the demo, and the journey diagram sends a
 * new recruiter straight from onboarding to "create a listing". That's the *first-run* path — a
 * returning recruiter with three live roles shouldn't be dropped onto a blank creation form. This
 * screen is that returning state, and the empty state below is the first-run one.
 */

export interface JobsDashboardScreenProps {
  onCreateJob: () => void;
  onReviewCandidates: (job: Job) => void;
}

export function JobsDashboardScreen({ onCreateJob, onReviewCandidates }: JobsDashboardScreenProps) {
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ['jobs', 'mine'],
    queryFn: jobsApi.mine,
  });

  if (isPending) return <ListSkeleton />;

  if (isError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState title="Couldn't load your listings" onRetry={() => void refetch()} />
      </SafeAreaView>
    );
  }

  const jobs = data ?? [];
  const active = jobs.filter((j) => j.status === 'active').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[type('h3'), styles.title]}>Your listings</Text>
          <Text style={[type('dataS'), styles.count]}>
            {active} open · {jobs.length} total
          </Text>
        </View>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Post your first role"
            body="Add a listing and we'll rank every candidate against it. You only appear to people who want the job."
            actionLabel="Create a listing"
            onAction={onCreateJob}
          />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          renderItem={({ item }) => (
            <JobRow job={item} onReview={() => onReviewCandidates(item)} />
          )}
          ListFooterComponent={
            <View style={styles.footerAction}>
              <Button label="Post another role" variant="secondary" onPress={onCreateJob} fullWidth />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function JobRow({ job, onReview }: { job: Job; onReview: () => void }) {
  const filled = job.status === 'filled';
  const visible = job.techStack.slice(0, 4);
  const overflow = Math.max(0, job.techStack.length - visible.length);

  return (
    <View style={[styles.card, filled && styles.cardFilled]}>
      <View style={styles.cardHeader}>
        <Text style={[type('h3'), styles.jobTitle]} numberOfLines={2}>
          {job.title}
        </Text>
        <View style={[styles.status, filled ? styles.statusFilled : styles.statusOpen]}>
          <Text style={[type('caption'), filled ? styles.statusLabelFilled : styles.statusLabelOpen]}>
            {filled ? 'Filled' : 'Open'}
          </Text>
        </View>
      </View>

      <Text style={[type('dataL'), styles.salary]}>
        {formatSalaryRange(job.compMin, job.compMax)}
      </Text>
      <Text style={[type('dataS'), styles.meta]}>
        {formatWorkMode(job.workMode)}
        {job.locationCity ? ` · ${job.locationCity}` : ''} · Posted {formatRelativeTime(job.createdAt)}
      </Text>

      <View style={styles.chips}>
        {visible.map((skill) => (
          <SkillChip key={skill} label={skill} />
        ))}
        {overflow > 0 && <SkillChip label={`+${overflow}`} />}
      </View>

      {filled ? (
        <Text style={[type('caption'), styles.filledNote]}>
          Closed to new candidates. Still visible to you.
        </Text>
      ) : (
        <Pressable
          onPress={onReview}
          accessibilityRole="button"
          accessibilityLabel={`Review candidates for ${job.title}`}
          style={({ pressed }) => [styles.reviewAction, pressed && styles.reviewActionPressed]}
        >
          <Text style={[type('button'), styles.reviewLabel]}>Review candidates</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  title: { color: tokens.color.textPrimary },
  count: { color: tokens.color.textSecondary, marginTop: 2 },
  emptyWrap: { flex: 1 },
  list: { padding: tokens.spacing.lg, gap: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
    ...tokens.shadow.card,
  },
  cardFilled: { backgroundColor: tokens.color.surfaceAlt },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.md },
  jobTitle: { color: tokens.color.textPrimary, flex: 1 },
  status: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
  },
  statusOpen: { backgroundColor: tokens.color.successTint },
  statusFilled: { backgroundColor: tokens.color.border },
  statusLabelOpen: { color: tokens.color.success },
  statusLabelFilled: { color: tokens.color.textSecondary },
  salary: { color: tokens.color.textPrimary, marginTop: tokens.spacing.xs },
  meta: { color: tokens.color.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  reviewAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primary,
    marginTop: tokens.spacing.md,
  },
  reviewActionPressed: { backgroundColor: tokens.color.primaryPressed },
  reviewLabel: { color: tokens.color.textInverse },
  filledNote: { color: tokens.color.textSecondary, marginTop: tokens.spacing.md },
  footerAction: { marginTop: tokens.spacing.sm },
});
