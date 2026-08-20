import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * SkillChip — Frontend Spec §4.1.
 *
 * The pill radius here is the one deliberate exception to the "never fully rounded" card rule:
 * chips are meant to read as tags, not buttons.
 *
 * `matched` is the load-bearing variant. On a job card it marks skills the candidate already has;
 * on a candidate card it marks skills this job asked for. It is how a recruiter or candidate reads
 * *why* the score is what it is without opening anything.
 */

export type SkillChipVariant = 'default' | 'matched' | 'selected';

export interface SkillChipProps {
  label: string;
  variant?: SkillChipVariant;
  onPress?: () => void;
}

function SkillChipComponent({ label, variant = 'default', onPress }: SkillChipProps) {
  const content = (
    <View style={[styles.chip, VARIANT_CONTAINER[variant]]}>
      <Text style={[type('caption'), VARIANT_TEXT[variant]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: variant === 'selected' }}
      // Chips are visually ~28px tall; hitSlop brings the tappable area to the 44pt minimum
      // (Frontend Spec §12) without inflating the layout.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
  },
});

const VARIANT_CONTAINER = StyleSheet.create({
  default: {
    backgroundColor: tokens.color.surfaceAlt,
    borderColor: tokens.color.border,
  },
  matched: {
    backgroundColor: tokens.color.primaryTint,
    borderColor: tokens.color.primaryTint,
  },
  selected: {
    backgroundColor: tokens.color.primary,
    borderColor: tokens.color.primary,
  },
});

const VARIANT_TEXT = StyleSheet.create({
  default: { color: tokens.color.textSecondary },
  matched: { color: tokens.color.primary },
  selected: { color: tokens.color.textInverse },
});

export const SkillChip = memo(SkillChipComponent);
