import { AuthScreen } from '../screens/onboarding/AuthScreen';

/**
 * Pre-auth flow.
 *
 * A single screen. Login is the default view, since the common case is a returning user; signup
 * is a link tap away and asks for role inside the form itself, once someone has actually said they
 * want an account. Previously a two-screen flow (role select, then auth) — folded down after the
 * separate role screen read as an unwanted extra step for a returning user with nowhere to go but
 * through it.
 */
export function OnboardingNavigator() {
  return <AuthScreen />;
}
