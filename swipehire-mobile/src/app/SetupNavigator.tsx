import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { PROFILE_KEY } from '../hooks/useProfile';
import { CandidateBasicsScreen } from '../screens/candidate/profile/CandidateBasicsScreen';
import { PreferencesScreen } from '../screens/candidate/profile/PreferencesScreen';
import { ResumeUploadScreen } from '../screens/candidate/profile/ResumeUploadScreen';
import { ReviewSkillsScreen } from '../screens/candidate/profile/ReviewSkillsScreen';
import { RecruiterSetupScreen } from '../screens/recruiter/profile/RecruiterSetupScreen';
import type { UserRole } from '../types';

export type SetupParamList = {
  Basics: undefined;
  Resume: undefined;
  ReviewSkills: { skills: string[] };
  Preferences: undefined;
  RecruiterSetup: undefined;
};

const Stack = createNativeStackNavigator<SetupParamList>();

/**
 * Onboarding between signing up and reaching the app.
 *
 * There is no "finish" navigation at the end. Completing the last step invalidates the profile
 * query; RootNavigator sees a now-complete profile and swaps this stack for the tabs. Same reason
 * the auth screens don't navigate either — one place decides where a user belongs.
 */
export function SetupNavigator({ role }: { role: UserRole }) {
  const qc = useQueryClient();
  // Held here rather than in the profile: skills are only persisted once the user has reviewed
  // them, so between parsing and confirming they exist nowhere else.
  const [parsedSkills, setParsedSkills] = useState<string[]>([]);

  const finish = () => qc.invalidateQueries({ queryKey: PROFILE_KEY });

  if (role === 'recruiter') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RecruiterSetup">
          {() => <RecruiterSetupScreen onDone={finish} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Basics">
        {({ navigation }) => <CandidateBasicsScreen onDone={() => navigation.navigate('Resume')} />}
      </Stack.Screen>

      <Stack.Screen name="Resume">
        {({ navigation }) => (
          <ResumeUploadScreen
            onParsed={(skills) => {
              setParsedSkills(skills);
              navigation.navigate('ReviewSkills', { skills });
            }}
            // Skipping is a real path: the review screen doubles as manual entry, so a candidate
            // without a PDF to hand isn't stuck.
            onSkip={() => navigation.navigate('ReviewSkills', { skills: [] })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ReviewSkills">
        {({ navigation, route }) => (
          <ReviewSkillsScreen
            initialSkills={route.params?.skills ?? parsedSkills}
            onDone={() => navigation.navigate('Preferences')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Preferences">{() => <PreferencesScreen onDone={finish} />}</Stack.Screen>
    </Stack.Navigator>
  );
}
