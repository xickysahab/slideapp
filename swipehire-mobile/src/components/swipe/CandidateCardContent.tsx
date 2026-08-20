import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { CandidateCardData } from '../../types';
import { formatWorkMode, formatYears, initials, rankSkills } from '../../utils/format';
import { SkillChip } from '../ui/SkillChip';
import { MatchSeal } from './MatchSeal';

/**
 * Recruiter-facing candidate card body — Frontend Spec §6.
 *
 * Deliberately **not** photo-first. The card leads with role and signal; the avatar is a 32px
 * initials monogram inline with the name, and the name is first name + last initial only. This is
 * an anti-bias default from the product spec (§6 product note, Demo PRD §2 row 23), not a
 * placeholder waiting for real photos — and the API withholds the rest of the identity anyway, so
 * there is nothing here to "fill in later".
 */

export interface CandidateCardContentProps {
  candidate: CandidateCardData;
  /**
   * Hides the score. A match score only means something relative to a specific listing, so the
   * "how recruiters see you" preview on a candidate's own profile has none to show — and rendering
   * a 0% there reads as "you are a bad match", which is both wrong and discouraging.
   */
  showMatchSeal?: boolean;
}

function CandidateCardContentComponent({
  candidate,
  showMatchSeal = true,
}: CandidateCardContentProps) {
  const { visible, overflow } = rankSkills(candidate.skills, candidate.matchedSkills);

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={[type('caption'), styles.avatarLabel]}>
              {initials(candidate.firstName, candidate.lastInitial)}
            </Text>
          </View>
          <Text style={[type('h3'), styles.name]} numberOfLines={1}>
            {candidate.firstName} {candidate.lastInitial}.
          </Text>
        </View>

        {showMatchSeal && <MatchSeal matchPercent={candidate.matchScore} size="md" animateIn />}
      </View>

      <Text style={[type('h3'), styles.role]} numberOfLines={1}>
        {candidate.currentTitle ?? 'Role not stated'}
      </Text>

      <Text style={[type('dataS'), styles.meta]}>
        {formatYears(candidate.yearsExperience)} · {formatWorkMode(candidate.preferredWorkMode)}
      </Text>

      <View style={styles.chipRow}>
        {visible.map((s) => (
          <SkillChip key={s.label} label={s.label} variant={s.matched ? 'matched' : 'default'} />
        ))}
        {overflow > 0 && <SkillChip label={`+${overflow}`} />}
      </View>

      {candidate.headline ? (
        <View style={styles.achievementRow}>
          <View style={styles.achievementMark} />
          <Text style={[type('bodyM'), styles.achievement]} numberOfLines={1}>
            {candidate.headline}
          </Text>
        </View>
      ) : null}

      {candidate.hasResume ? (
        <Text style={[type('caption'), styles.resume]}>Resume available</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: tokens.spacing.lg, gap: tokens.spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, flex: 1 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { color: tokens.color.primary },
  name: { color: tokens.color.textPrimary, flexShrink: 1 },
  role: { color: tokens.color.textPrimary, marginTop: tokens.spacing.xs },
  meta: { color: tokens.color.textSecondary },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  // A gold square rather than a star glyph: §0 rules out emoji-style marks, and gold as a small
  // fill (never as text) is the one place the accent is allowed.
  achievementMark: {
    width: tokens.spacing.sm,
    height: tokens.spacing.sm,
    borderRadius: 2,
    backgroundColor: tokens.color.secondary,
  },
  achievement: { color: tokens.color.textPrimary, flex: 1 },
  resume: { color: tokens.color.textSecondary, marginTop: tokens.spacing.xs },
});

export const CandidateCardContent = memo(
  CandidateCardContentComponent,
  (a, b) =>
    a.candidate.id === b.candidate.id &&
    a.candidate.matchScore === b.candidate.matchScore &&
    a.showMatchSeal === b.showMatchSeal,
);
