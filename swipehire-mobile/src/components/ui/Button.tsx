import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * Button — Frontend Spec §4.1 / §4.2.
 *
 * The spec's `icon?: PhosphorIcon` prop is not implemented yet: the Phosphor icon set isn't
 * installed, and a stand-in icon family would violate the §1 iconography rule. Added with the
 * icon pass, before any screen that needs a leading icon ships.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
}

/** `md` is 48px per spec; `sm` stays at 44 so it still clears the minimum touch target (§12). */
const HEIGHTS: Record<ButtonSize, number> = { sm: 44, md: 48, lg: 56 };

function ButtonComponent({
  label,
  variant = 'primary',
  size = 'md',
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
}: ButtonProps) {
  const isInert = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size] },
        CONTAINER[variant],
        fullWidth && styles.fullWidth,
        pressed && !isInert && PRESSED[variant],
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'destructive' ? tokens.color.textInverse : tokens.color.primary}
        />
      ) : (
        <View style={styles.labelWrap}>
          <Text style={[type('button'), LABEL[variant]]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
  },
  /**
   * Stretch only — no `flex: 1`.
   *
   * With flex, a button inside a column collapses to zero height and renders as a hairline, since
   * flex distributes the *remaining* space and a content-sized card has none. Buttons that need to
   * share a row get their flex from a wrapper on the parent's side, where the row actually is.
   */
  fullWidth: { alignSelf: 'stretch' },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  disabled: { opacity: 0.4 },
});

const CONTAINER = StyleSheet.create({
  primary: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  secondary: { backgroundColor: tokens.color.surface, borderColor: tokens.color.secondary },
  ghost: { backgroundColor: 'transparent', borderColor: tokens.color.border },
  destructive: { backgroundColor: tokens.color.error, borderColor: tokens.color.error },
}) as Record<ButtonVariant, ViewStyle>;

const PRESSED = StyleSheet.create({
  primary: { backgroundColor: tokens.color.primaryPressed, borderColor: tokens.color.primaryPressed },
  secondary: { backgroundColor: tokens.color.secondaryTint },
  ghost: { backgroundColor: tokens.color.surfaceAlt },
  destructive: { opacity: 0.85 },
}) as Record<ButtonVariant, ViewStyle>;

const LABEL = StyleSheet.create({
  primary: { color: tokens.color.textInverse },
  // Gold (#D6A24C) fails AA at body size, so the secondary button borders in gold but labels in
  // ink — Frontend Spec §12 / tokens.ts header.
  secondary: { color: tokens.color.textPrimary },
  ghost: { color: tokens.color.textSecondary },
  destructive: { color: tokens.color.textInverse },
});

export const Button = memo(ButtonComponent);
