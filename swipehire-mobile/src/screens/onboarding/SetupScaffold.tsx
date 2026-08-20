import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * Shared chrome for the onboarding steps: step counter, headline, scrollable body, sticky action.
 *
 * Four screens with the same shape, so the layout lives once. It also keeps the step counter
 * honest — each screen states which step it is, rather than each reimplementing a progress bar and
 * drifting.
 */

export interface SetupScaffoldProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  error?: string | null;
}

export function SetupScaffold({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  busy,
  secondaryLabel,
  onSecondary,
  error,
}: SetupScaffoldProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* A single-step flow has no progress to report; showing "Step 1 of 1" is just noise. */}
        {totalSteps > 1 && (
          <View style={styles.header}>
            <View style={styles.progress} accessibilityLabel={`Step ${step} of ${totalSteps}`}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <View key={i} style={[styles.tick, i < step && styles.tickDone]} />
              ))}
            </View>
            <Text style={[type('dataS'), styles.stepLabel]}>
              Step {step} of {totalSteps}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[type('h1'), styles.title]}>{title}</Text>
          {subtitle && <Text style={[type('bodyM'), styles.subtitle]}>{subtitle}</Text>}

          <View style={styles.content}>{children}</View>

          {error && <Text style={[type('bodyM'), styles.error]}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
            loading={busy}
            fullWidth
          />
          {secondaryLabel && onSecondary && (
            <Button
              label={secondaryLabel}
              variant="ghost"
              onPress={onSecondary}
              disabled={busy}
              fullWidth
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  progress: { flexDirection: 'row', gap: tokens.spacing.xs },
  tick: {
    flex: 1,
    height: 3,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.border,
  },
  tickDone: { backgroundColor: tokens.color.primary },
  stepLabel: { color: tokens.color.textSecondary },
  body: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  title: { color: tokens.color.textPrimary },
  subtitle: { color: tokens.color.textSecondary },
  content: { marginTop: tokens.spacing.xl, gap: tokens.spacing.lg },
  error: { color: tokens.color.error, marginTop: tokens.spacing.lg },
  footer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
});
