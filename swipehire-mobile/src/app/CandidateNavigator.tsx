import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import { PROFILE_KEY } from '../hooks/useProfile';
import { ResumeUploadScreen } from '../screens/candidate/profile/ResumeUploadScreen';
import { ReviewSkillsScreen } from '../screens/candidate/profile/ReviewSkillsScreen';
import { JobDetailsScreen } from '../screens/candidate/discover/JobDetailsScreen';
import { SwipeDeckScreen } from '../screens/candidate/discover/SwipeDeckScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { MatchesListScreen } from '../screens/shared/MatchesListScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import type { JobCardData } from '../types';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { TabLabel } from './TabLabel';
import { tabScreenOptions } from './tabBarStyle';

/**
 * Candidate tabs — Frontend Spec §4.
 *
 * Discover and Matches each get their own stack so a pushed screen keeps its tab bar and its own
 * back history, which is what makes tabbing away from a chat and back feel like returning rather
 * than reloading.
 */

type DiscoverStackParams = {
  Deck: undefined;
  JobDetails: { job: JobCardData };
};

type MatchesStackParams = {
  MatchesList: undefined;
  Chat: { matchId: string };
};

type ProfileStackParams = {
  ProfileMain: undefined;
  ResumeUpdate: undefined;
  ResumeSkills: { skills: string[] };
};

const DiscoverStack = createNativeStackNavigator<DiscoverStackParams>();
const MatchesStack = createNativeStackNavigator<MatchesStackParams>();
const ProfileStack = createNativeStackNavigator<ProfileStackParams>();
const Tabs = createBottomTabNavigator();

function DiscoverFlow() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
      <DiscoverStack.Screen name="Deck">
        {({ navigation }) => (
          <SwipeDeckScreen
            onOpenDetails={(job) => navigation.navigate('JobDetails', { job })}
            // Jumping straight into the new conversation is the point of the match moment; the
            // Matches tab is where you'd go to find it later, not in that first second.
            onOpenMatch={(matchId) =>
              navigation.getParent()?.navigate('MatchesTab', {
                screen: 'Chat',
                params: { matchId },
              })
            }
          />
        )}
      </DiscoverStack.Screen>

      <DiscoverStack.Screen name="JobDetails">
        {({ navigation, route }) => (
          <JobDetailsScreen job={route.params.job} onBack={() => navigation.goBack()} />
        )}
      </DiscoverStack.Screen>
    </DiscoverStack.Navigator>
  );
}

function MatchesFlow() {
  return (
    <MatchesStack.Navigator screenOptions={{ headerShown: false }}>
      <MatchesStack.Screen name="MatchesList">
        {({ navigation }) => (
          <MatchesListScreen
            role="candidate"
            onOpenMatch={(matchId) => navigation.navigate('Chat', { matchId })}
          />
        )}
      </MatchesStack.Screen>

      <MatchesStack.Screen name="Chat">
        {({ navigation, route }) => (
          <ChatScreen
            matchId={route.params.matchId}
            role="candidate"
            onBack={() => navigation.goBack()}
          />
        )}
      </MatchesStack.Screen>
    </MatchesStack.Navigator>
  );
}

/**
 * Profile, plus the resume-replace flow reached from it.
 *
 * The upload and review screens were previously only mounted inside onboarding, so a candidate who
 * had finished setup had no way back to them — the profile could report "Resume: Uploaded" with no
 * means of changing it. Both screens take a `mode` prop rather than being duplicated, so the
 * parsing behaviour stays in one place and only the chrome differs.
 */
function ProfileFlow() {
  const qc = useQueryClient();

  // Parsing writes the resume key server-side before the skills are confirmed, so backing out of
  // the review step still changes the profile. Refetch on the way out either way, or the card goes
  // on showing the old state.
  const refresh = () => void qc.invalidateQueries({ queryKey: PROFILE_KEY });

  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <ProfileStack.Screen name="ProfileMain">
        {({ navigation }) => (
          <ProfileScreen onManageResume={() => navigation.navigate('ResumeUpdate')} />
        )}
      </ProfileStack.Screen>

      <ProfileStack.Screen name="ResumeUpdate">
        {({ navigation }) => (
          <ResumeUploadScreen
            mode="update"
            onParsed={(skills) => navigation.navigate('ResumeSkills', { skills })}
            onSkip={() => {
              refresh();
              navigation.goBack();
            }}
          />
        )}
      </ProfileStack.Screen>

      <ProfileStack.Screen name="ResumeSkills">
        {({ navigation, route }) => (
          <ReviewSkillsScreen
            mode="update"
            initialSkills={route.params.skills}
            onDone={() => {
              refresh();
              navigation.popToTop();
            }}
          />
        )}
      </ProfileStack.Screen>
    </ProfileStack.Navigator>
  );
}

export function CandidateNavigator() {
  // Lives at the navigator so the badge updates wherever the user is — including mid-swipe, which
  // is the whole point of having one.
  const unread = useUnreadCount();

  return (
    <Tabs.Navigator screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="DiscoverTab"
        component={DiscoverFlow}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label="Discover" focused={focused} /> }}
      />
      <Tabs.Screen
        name="MatchesTab"
        component={MatchesFlow}
        options={{
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Matches" focused={focused} count={unread} />
          ),
        }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileFlow}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} /> }}
      />
    </Tabs.Navigator>
  );
}
