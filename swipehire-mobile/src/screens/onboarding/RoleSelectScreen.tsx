import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { UserRole } from '../../types';

/**
 * Role selection — Frontend Spec §9, candidate screen 3.
 *
 * Comes before the signup form, matching the journey diagram (Select Role → Sign Up). The choice is
 * carried into the signup request rather than set afterwards: role decides which half of the
 * product exists for this account, and the server treats it as fixed once set.
 */

export interface RoleSelectScreenProps {
  onSelect: (role: UserRole) => void;
  onHaveAccount: () => void;
}

export function RoleSelectScreen({ onSelect, onHaveAccount }: RoleSelectScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[type('displayL'), styles.title]}>Which side are you on?</Text>
        <Text style={[type('bodyL'), styles.subtitle]}>
          You can only be one. It decides what you see.
        </Text>
      </View>

      <View style={styles.options}>
        <RoleCard
          title="I'm looking for a role"
          body="Upload your resume once, then swipe through jobs that actually fit. Recruiters only see you if you're interested first."
          actionLabel="Continue as candidate"
          onPress={() => onSelect('candidate')}
        />
        <RoleCard
          title="I'm hiring"
          body="Post a listing, then review candidates ranked against it. You only appear to people who want the role."
          actionLabel="Continue as recruiter"
          onPress={() => onSelect('recruiter')}
        />
      </View>

      <View style={styles.footer}>
        <Button label="I already have an account" variant="ghost" onPress={onHaveAccount} fullWidth />
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  title,
  body,
  actionLabel,
  onPress,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={[type('h2'), styles.cardTitle]}>{title}</Text>
      <Text style={[type('bodyM'), styles.cardBody]}>{body}</Text>
      <Button label={actionLabel} onPress={onPress} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.background,
    paddingHorizontal: tokens.spacing.lg,
  },
  header: { paddingTop: tokens.spacing.xxl, gap: tokens.spacing.sm },
  title: { color: tokens.color.textPrimary },
  subtitle: { color: tokens.color.textSecondary },
  options: { flex: 1, justifyContent: 'center', gap: tokens.spacing.lg },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.spacing.xl,
    gap: tokens.spacing.md,
    ...tokens.shadow.card,
  },
  cardTitle: { color: tokens.color.textPrimary },
  cardBody: { color: tokens.color.textSecondary, marginBottom: tokens.spacing.sm },
  footer: { paddingBottom: tokens.spacing.lg },
});
