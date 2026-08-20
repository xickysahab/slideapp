import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

/**
 * Loads the three type roles from Frontend Spec §3. Nothing should render text before this
 * resolves — a first paint in the system font followed by a swap to Fraunces is a visible flash
 * that reads as an unfinished app.
 *
 * The faces here must stay in sync with REQUIRED_FONTS in theme/typography.ts.
 */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  return { fontsLoaded: loaded, fontError: error };
}
