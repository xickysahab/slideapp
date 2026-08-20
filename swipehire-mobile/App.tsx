import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/app/RootNavigator';
import { useAppFonts } from './src/hooks/useAppFonts';
import { tokens } from './src/theme/tokens';

/**
 * Provider stack. Routing lives in RootNavigator; this file only assembles what it needs.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry, not three. On a phone the common failure is "no signal", and three silent
      // retries just make the error state take six seconds to appear.
      retry: 1,
      staleTime: 10_000,
    },
  },
});

export default function App() {
  const { fontsLoaded, fontError } = useAppFonts();

  // Nothing renders text before the three type roles are available — a flash of system font
  // followed by a swap to Fraunces is the kind of detail that reads as unfinished.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.color.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
          <StatusBar style="dark" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
