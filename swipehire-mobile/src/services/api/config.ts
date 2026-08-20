/**
 * API endpoint configuration.
 *
 * `EXPO_PUBLIC_API_URL` must be the backend's **origin** (no trailing path). Anything prefixed
 * `EXPO_PUBLIC_` is inlined into the JS bundle at build time, so this must never hold a secret —
 * it's a URL, which is fine.
 *
 * Local development note: `localhost` resolves to the *phone*, not your Mac, when running in
 * Expo Go on a physical device. Use your machine's LAN IP there (e.g. http://192.168.1.20:3000).
 * The iOS Simulator is the exception — it shares the host's localhost.
 *
 * After DEMO-20 this points at the deployed Railway/Render URL.
 */
const DEFAULT_ORIGIN = 'http://localhost:3000';

export const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_ORIGIN;

/** Feature endpoints live under `/api`; `/health` deliberately does not (see api/src/main.ts). */
export const API_BASE_URL = `${API_ORIGIN}/api`;

export const HEALTH_URL = `${API_ORIGIN}/health`;
