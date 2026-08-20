import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { JobCardData } from '../../types';
import {
  formatExperience,
  formatRelativeTime,
  formatSalaryRange,
  formatWorkMode,
  rankSkills,
} from '../../utils/format';
import { SkillChip } from '../ui/SkillChip';
import { MatchSeal } from './MatchSeal';

/**
 * Candidate-facing job card body — Frontend Spec §5, laid out top to bottom exactly as specified:
 * logo + seal row, title, company · location, salary + work mode, experience + recency, skill row,
 * clamped description.
 *
 * The action row is not here — it belongs to SwipeCard, which owns the gesture the buttons mirror.
 */

export interface JobCardContentProps {
  job: JobCardData;
}

function JobCardContentComponent({ job }: JobCardContentProps) {
  const { visible, overflow } = rankSkills(job.techStack, job.matchedSkills);

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        {job.companyLogoUrl ? (
          <Image
            source={{ uri: job.companyLogoUrl }}
            style={styles.logo}
            contentFit="contain"
            // Disk cache + a fixed box means logos never re-decode as cards promote (§8).
            cachePolicy="disk"
            transition={0}
            accessibilityLabel={`${job.companyName} logo`}
          />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={[type('h3'), styles.monogram]}>{job.companyName.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <MatchSeal matchPercent={job.matchScore} size="md" animateIn />
      </View>

      <Text style={[type('h3'), styles.title]} numberOfLines={1}>
        {job.title}
      </Text>
      <Text style={[type('bodyM'), styles.subtitle]} numberOfLines={1}>
        {job.companyName} · {job.locationCity}
      </Text>

      <View style={styles.factRow}>
        <Text style={[type('dataL'), styles.salary]}>{formatSalaryRange(job.compMin, job.compMax)}</Text>
        <View style={styles.workModeChip}>
          <Text style={[type('caption'), styles.workModeLabel]}>{formatWorkMode(job.workMode)}</Text>
        </View>
      </View>

      <Text style={[type('dataS'), styles.meta]}>
        {formatExperience(job.experienceMinYears, job.experienceMaxYears)} · Posted{' '}
        {formatRelativeTime(job.postedAt)}
      </Text>

      <View style={styles.chipRow}>
        {visible.map((s) => (
          <SkillChip key={s.label} label={s.label} variant={s.matched ? 'matched' : 'default'} />
        ))}
        {overflow > 0 && <SkillChip label={`+${overflow}`} />}
      </View>

      <Text style={[type('bodyM'), styles.description]} numberOfLines={2}>
        {job.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: tokens.spacing.lg, gap: tokens.spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logo: { width: 40, height: 40, borderRadius: tokens.radius.sm },
  logoFallback: {
    backgroundColor: tokens.color.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: { color: tokens.color.primary },
  title: { color: tokens.color.textPrimary, marginTop: tokens.spacing.xs },
  subtitle: { color: tokens.color.textSecondary },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  salary: { color: tokens.color.textPrimary },
  workModeChip: {
    backgroundColor: tokens.color.secondaryTint,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  workModeLabel: { color: tokens.color.textPrimary },
  meta: { color: tokens.color.textSecondary },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  description: { color: tokens.color.textPrimary, marginTop: tokens.spacing.sm },
});

export const JobCardContent = memo(
  JobCardContentComponent,
  (a, b) => a.job.id === b.job.id && a.job.matchScore === b.job.matchScore,
);
