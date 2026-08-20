import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CandidateDeckScreen } from '../screens/recruiter/discover/CandidateDeckScreen';
import { JobCreateScreen } from '../screens/recruiter/jobs/JobCreateScreen';
import { JobsDashboardScreen } from '../screens/recruiter/jobs/JobsDashboardScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { MatchesListScreen } from '../screens/shared/MatchesListScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import type { Job } from '../types';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { TabLabel } from './TabLabel';
import { tabScreenOptions } from './tabBarStyle';

/**
 * Recruiter tabs — Frontend Spec §4, with the dashboard promoted to the landing tab.
 *
 * The spec's recruiter tree opens on a discover tab with a job selector in the header. This opens
 * on the listings instead, because a recruiter's deck only means anything relative to a listing —
 * the job is the context, so choosing it is the first act rather than a dropdown on top of a deck
 * that had to pick one for them.
 */

type JobsStackParams = {
  Dashboard: undefined;
  CreateJob: undefined;
  CandidateDeck: { job: Job };
};

type MatchesStackParams = {
  MatchesList: undefined;
  Chat: { matchId: string };
};

const JobsStack = createNativeStackNavigator<JobsStackParams>();
const MatchesStack = createNativeStackNavigator<MatchesStackParams>();
const Tabs = createBottomTabNavigator();

function JobsFlow() {
  return (
    <JobsStack.Navigator screenOptions={{ headerShown: false }}>
      <JobsStack.Screen name="Dashboard">
        {({ navigation }) => (
          <JobsDashboardScreen
            onCreateJob={() => navigation.navigate('CreateJob')}
            onReviewCandidates={(job) => navigation.navigate('CandidateDeck', { job })}
          />
        )}
      </JobsStack.Screen>

      <JobsStack.Screen
        name="CreateJob"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {({ navigation }) => (
          <JobCreateScreen
            onCreated={() => navigation.goBack()}
            onCancel={() => navigation.goBack()}
          />
        )}
      </JobsStack.Screen>

      <JobsStack.Screen name="CandidateDeck">
        {({ navigation, route }) => (
          <CandidateDeckScreen
            job={route.params.job}
            onBack={() => navigation.goBack()}
            // Candidate details would push here; the deck's own card carries everything the
            // pre-match payload contains, so there is nothing further to show yet.
            onOpenDetails={() => undefined}
            onOpenMatch={(matchId) =>
              navigation.getParent()?.navigate('MatchesTab', {
                screen: 'Chat',
                params: { matchId },
              })
            }
          />
        )}
      </JobsStack.Screen>
    </JobsStack.Navigator>
  );
}

function MatchesFlow() {
  return (
    <MatchesStack.Navigator screenOptions={{ headerShown: false }}>
      <MatchesStack.Screen name="MatchesList">
        {({ navigation }) => (
          <MatchesListScreen
            role="recruiter"
            onOpenMatch={(matchId) => navigation.navigate('Chat', { matchId })}
          />
        )}
      </MatchesStack.Screen>

      <MatchesStack.Screen name="Chat">
        {({ navigation, route }) => (
          <ChatScreen
            matchId={route.params.matchId}
            role="recruiter"
            onBack={() => navigation.goBack()}
          />
        )}
      </MatchesStack.Screen>
    </MatchesStack.Navigator>
  );
}

export function RecruiterNavigator() {
  // See the note in CandidateNavigator — the badge has to update from anywhere in the app.
  const unread = useUnreadCount();

  return (
    <Tabs.Navigator screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="JobsTab"
        component={JobsFlow}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label="Listings" focused={focused} /> }}
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
        component={ProfileScreen}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label="Company" focused={focused} /> }}
      />
    </Tabs.Navigator>
  );
}
