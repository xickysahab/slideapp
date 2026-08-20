import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError, NetworkError } from '../../services/api/client';
import { useAuth } from '../../store/auth';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { UserRole } from '../../types';

/**
 * Sign up / log in — Frontend Spec §9, candidate screen 4, "simplified: email/password + Google
 * only, no phone OTP, no biometric".
 *
 * Google sign-in is implemented on the server but not offered here: its redirect scheme needs an
 * EAS dev build, which Expo Go can't provide (see CLAUDE.md). Rather than show a button that can't
 * work, it isn't shown.
 */

export interface AuthScreenProps {
  /** Set when arriving from role selection; absent means this is a returning user logging in. */
  role?: UserRole;
  onBack: () => void;
}

export function AuthScreen({ role, onBack }: AuthScreenProps) {
  const isSignup = role !== undefined;
  const { signup, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!email.includes('@')) next.email = 'Enter a valid email address';
    // Mirrors the server's rule, so an obvious problem is caught without a round trip.
    if (isSignup && password.length < 8) next.password = 'At least 8 characters';
    if (!isSignup && password.length === 0) next.password = 'Enter your password';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      if (isSignup) await signup(email.trim(), password, role);
      else await login(email.trim(), password);
      // No navigation here: RootNavigator switches stacks off the auth state itself, so there is
      // one place that decides where a signed-in user belongs.
    } catch (err) {
      if (err instanceof NetworkError) setError("Couldn't reach the server. Check your connection.");
      else if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[type('displayL'), styles.title]}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={[type('bodyM'), styles.subtitle]}>
            {isSignup
              ? role === 'candidate'
                ? 'Then upload your resume and start swiping.'
                : 'Then set up your company and post your first role.'
              : 'Sign in to pick up where you left off.'}
          </Text>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
              error={fieldErrors.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              editable={!busy}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
              error={fieldErrors.password}
              helper={isSignup ? 'At least 8 characters' : undefined}
              secureTextEntry
              autoCapitalize="none"
              // `newPassword` on signup so the OS offers to generate and save one; `password` on
              // login so it offers the saved one instead.
              textContentType={isSignup ? 'newPassword' : 'password'}
              editable={!busy}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          </View>

          {error && <ErrorState variant="inline" title="Couldn't sign you in" message={error} />}

          <View style={styles.actions}>
            <Button
              label={isSignup ? 'Create account' : 'Log in'}
              onPress={submit}
              loading={busy}
              fullWidth
            />
            <Button label="Back" variant="ghost" onPress={onBack} disabled={busy} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  title: { color: tokens.color.textPrimary },
  subtitle: { color: tokens.color.textSecondary },
  form: { marginTop: tokens.spacing.xl, gap: tokens.spacing.lg },
  actions: { marginTop: tokens.spacing.xl, gap: tokens.spacing.md },
});
