import { NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';

import { ErrorState } from '../components/feedback/ErrorState';
import { isSetupComplete, useMyProfile } from '../hooks/useProfile';
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { useSocketConnection } from '../services/socket';
import { useAuth } from '../store/auth';
import { CandidateNavigator } from './CandidateNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { RecruiterNavigator } from './RecruiterNavigator';
import { SetupNavigator } from './SetupNavigator';

/**
 * Decides which stack the user is in, from state rather than from navigation calls.
 *
 * Nothing anywhere navigates "to the app" after logging in, and nothing navigates "to login" after
 * logging out — the tree simply reflects the session and the profile. That keeps the answer to
 * "where does this user belong" in one place, and means a token expiring mid-session drops them
 * back to auth without any screen having to handle it.
 */
export function RootNavigator() {
  const { user, isRestoring, restore } = useAuth();
  const { data: profile, isPending, isError, refetch } = useMyProfile();

  useSocketConnection();

  useEffect(() => {
    void restore();
  }, [restore]);

  // Session is being checked, or the profile behind an existing session hasn't arrived yet.
  if (isRestoring || (user && isPending)) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {!user ? (
        <OnboardingNavigator />
      ) : isError ? (
        // A signed-in user whose profile won't load can't be routed anywhere sensible, so say so
        // and offer a retry rather than guessing and landing them in the wrong half of the app.
        <ErrorState
          title="Couldn't load your profile"
          message="You're signed in, but we couldn't fetch your details."
          onRetry={() => void refetch()}
        />
      ) : !isSetupComplete(profile) ? (
        <SetupNavigator role={profile!.role} />
      ) : profile!.role === 'candidate' ? (
        <CandidateNavigator />
      ) : (
        <RecruiterNavigator />
      )}
    </NavigationContainer>
  );
}
