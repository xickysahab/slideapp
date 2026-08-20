import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { ApiError, api, configureApiAuth } from '../services/api/client';
import type { AuthResponse, AuthUser, UserRole } from '../types';

/**
 * Auth state and token lifecycle.
 *
 * Tokens live in SecureStore — the Keychain on iOS, encrypted prefs on Android — not AsyncStorage.
 * A refresh token is a thirty-day session; leaving it in plain app storage would make a rooted or
 * jailbroken device hand it over for free.
 */

const ACCESS_KEY = 'swipehire.accessToken';
const REFRESH_KEY = 'swipehire.refreshToken';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True until the stored session has been checked on launch. Gates the splash screen. */
  isRestoring: boolean;

  signup: (email: string, password: string, role: UserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

async function persist(tokens: { accessToken: string; refreshToken: string } | null): Promise<void> {
  if (!tokens) {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
    return;
  }

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isRestoring: true,

  async signup(email, password, role) {
    const res = await api.post<AuthResponse>('/auth/signup', { email, password, role }, { authenticated: false });
    await persist(res);
    set({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
  },

  async login(email, password) {
    const res = await api.post<AuthResponse>('/auth/login', { email, password }, { authenticated: false });
    await persist(res);
    set({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
  },

  async logout() {
    const token = get().refreshToken;

    // Local state is cleared regardless of what the server says. If the request fails the user is
    // still logged out on this device, which is what they asked for; the token expires on its own.
    if (token) {
      await api.post('/auth/logout', { refreshToken: token }, { authenticated: false }).catch(() => undefined);
    }

    await persist(null);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  /**
   * Restores a session on launch.
   *
   * The stored access token is verified against `/auth/me` rather than trusted, so an account
   * deleted server-side doesn't leave the app in a logged-in state it can't act on. A 401 here is
   * handled by the client's own refresh, so reaching the catch means the session is genuinely over.
   */
  async restore() {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);

      if (!accessToken || !refreshToken) {
        set({ isRestoring: false });
        return;
      }

      set({ accessToken, refreshToken });
      const user = await api.get<AuthUser>('/auth/me');
      set({ user, isRestoring: false });
    } catch {
      await persist(null);
      set({ user: null, accessToken: null, refreshToken: null, isRestoring: false });
    }
  },
}));

/**
 * Hands the client its token accessor and refresh routine.
 *
 * Runs at module load so the wiring exists before any screen mounts — a request firing before this
 * ran would be sent unauthenticated and fail confusingly.
 */
configureApiAuth(
  () => useAuth.getState().accessToken,
  async () => {
    const current = useAuth.getState().refreshToken;
    if (!current) return null;

    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { refreshToken: current },
        // Not authenticated, and crucially not retried: a 401 here means the session is over, and
        // retrying would recurse into this same function.
        { authenticated: false },
      );

      await persist(res);
      useAuth.setState({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      return res.accessToken;
    } catch (err) {
      // Only a rejected session logs the user out. A network blip must not, or losing signal in a
      // lift would end the demo.
      if (err instanceof ApiError) {
        await persist(null);
        useAuth.setState({ user: null, accessToken: null, refreshToken: null });
      }
      return null;
    }
  },
);
