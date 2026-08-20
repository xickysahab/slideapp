import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthScreen } from '../screens/onboarding/AuthScreen';
import { RoleSelectScreen } from '../screens/onboarding/RoleSelectScreen';
import type { UserRole } from '../types';

export type OnboardingParamList = {
  RoleSelect: undefined;
  /** `role` present means signup; absent means an existing user logging in. */
  Auth: { role?: UserRole };
};

const Stack = createNativeStackNavigator<OnboardingParamList>();

/**
 * Pre-auth flow: pick a side, then sign up or log in.
 *
 * Frontend Spec §4 also lists optional onboarding slides between splash and role select. Demo
 * Frontend Spec §2 marks them skippable with no loss to the demo story, and they're the first thing
 * between a client and the swipe deck, so they aren't built.
 */
export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="RoleSelect">
        {({ navigation }) => (
          <RoleSelectScreen
            onSelect={(role) => navigation.navigate('Auth', { role })}
            onHaveAccount={() => navigation.navigate('Auth', {})}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Auth">
        {({ navigation, route }) => (
          <AuthScreen role={route.params?.role} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
