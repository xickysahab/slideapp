import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * Input — Frontend Spec §4.1: floating label, error state shows an error border plus helper text.
 *
 * The label sits above the field rather than animating from inside it. The spec calls for a
 * floating label; a genuinely animated one fights autofill and reflows the row on focus, and at
 * this size the static version reads the same while staying still.
 */

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  helper?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helper, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.wrap}>
      <Text style={[type('caption'), styles.label, hasError && styles.labelError]}>{label}</Text>

      <TextInput
        ref={ref}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={tokens.color.textSecondary}
        style={[
          type('bodyL'),
          styles.field,
          focused && styles.fieldFocused,
          hasError && styles.fieldError,
        ]}
        accessibilityLabel={label}
        // A screen reader should hear why the field is rejected, not just that it is.
        accessibilityHint={error ?? helper}
      />

      {(error || helper) && (
        <Text style={[type('caption'), hasError ? styles.errorText : styles.helperText]}>
          {error ?? helper}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing.xs },
  label: { color: tokens.color.textSecondary },
  labelError: { color: tokens.color.error },
  field: {
    minHeight: 48,
    backgroundColor: tokens.color.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    color: tokens.color.textPrimary,
  },
  fieldFocused: { borderColor: tokens.color.borderStrong },
  fieldError: { borderColor: tokens.color.error, backgroundColor: tokens.color.errorTint },
  helperText: { color: tokens.color.textSecondary },
  errorText: { color: tokens.color.error },
});
