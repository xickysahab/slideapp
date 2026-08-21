import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
 * Log in / sign up — Frontend Spec §9, candidate screen 4, "simplified: email/password + Google
 * only, no phone OTP, no biometric".
 *
 * The single entry point to the app. A returning user's own credentials are the common case, so
 * login is what's on screen first; signing up is one tap away rather than a screen someone has to
 * back out of. Role is asked inside the signup form itself, once someone has actually said they
 * want an account, rather than as a screen before anyone has expressed intent.
 *
 * Google sign-in is implemented on the server but not offered here: its redirect scheme needs an
 * EAS dev build, which Expo Go can't provide (see CLAUDE.md). Rather than show a button that can't
 * work, it isn't shown.
 */

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const { signup, login } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const isSignup = mode === 'signup';

  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; role?: string }>({});
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    // A stale error from one mode reads as a bug in the other; a mistyped password isn't a
    // reason to also re-type the email, so that alone survives the switch.
    setError(null);
    setFieldErrors({});
  }

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!email.includes('@')) next.email = 'Enter a valid email address';
    // Mirrors the server's rule, so an obvious problem is caught without a round trip.
    if (isSignup && password.length < 8) next.password = 'At least 8 characters';
    if (!isSignup && password.length === 0) next.password = 'Enter your password';
    if (isSignup && !role) next.role = 'Choose one';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      if (isSignup) await signup(email.trim(), password, role!);
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
            {isSignup ? 'Tell us which side you’re on, then set a password.' : 'Sign in to pick up where you left off.'}
          </Text>

          <View style={styles.form}>
            {isSignup && (
              <RolePicker
                value={role}
                onChange={(next) => {
                  setRole(next);
                  setFieldErrors((f) => ({ ...f, role: undefined }));
                }}
                error={fieldErrors.role}
                disabled={busy}
              />
            )}

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
          </View>

          <View style={styles.switchRow}>
            <Text style={[type('bodyM'), styles.switchPrompt]}>
              {isSignup ? 'Already have an account?' : "Don’t have an account?"}
            </Text>
            <Pressable
              onPress={() => switchMode(isSignup ? 'login' : 'signup')}
              disabled={busy}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="link"
              accessibilityLabel={isSignup ? 'Log in instead' : 'Sign up'}
            >
              <Text style={[type('bodyM'), styles.switchLink]}>
                {isSignup ? 'Log in' : 'Sign up'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * "I'm looking for a role" vs "I'm hiring" — Frontend Spec §9's role-select screen, folded into the
 * signup form rather than shown before it. The choice still travels into the signup request and is
 * fixed server-side once set (Backend.md §2); only where it's asked has moved.
 */
function RolePicker({
  value,
  onChange,
  error,
  disabled,
}: {
  value: UserRole | null;
  onChange: (role: UserRole) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.roleWrap}>
      <Text style={[type('caption'), styles.roleLabel, error && styles.roleLabelError]}>
        I'm here as
      </Text>
      <View style={styles.roleRow}>
        <RoleOption
          label="A job seeker"
          selected={value === 'candidate'}
          onPress={() => onChange('candidate')}
          disabled={disabled}
        />
        <RoleOption
          label="A recruiter / HR"
          selected={value === 'recruiter'}
          onPress={() => onChange('recruiter')}
          disabled={disabled}
        />
      </View>
      {error && <Text style={[type('caption'), styles.roleError]}>{error}</Text>}
    </View>
  );
}

function RoleOption({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.roleOption,
        selected && styles.roleOptionSelected,
        pressed && !disabled && !selected && styles.roleOptionPressed,
      ]}
    >
      <Text
        style={[type('bodyM'), styles.roleOptionLabel, selected && styles.roleOptionLabelSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
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

  switchRow: {
    marginTop: tokens.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  switchPrompt: { color: tokens.color.textSecondary },
  // The one deliberately underlined, primary-coloured piece of text in the app — everywhere else a
  // tap target is a button. This is meant to read as a hyperlink, not as chrome.
  switchLink: { color: tokens.color.primary, textDecorationLine: 'underline' },

  roleWrap: { gap: tokens.spacing.xs },
  roleLabel: { color: tokens.color.textSecondary },
  roleLabelError: { color: tokens.color.error },
  roleRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  roleOption: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  roleOptionPressed: { backgroundColor: tokens.color.surfaceAlt },
  roleOptionSelected: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  roleOptionLabel: { color: tokens.color.textPrimary },
  roleOptionLabelSelected: { color: tokens.color.textInverse },
  roleError: { color: tokens.color.error },
});
