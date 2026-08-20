import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { API_ORIGIN, HEALTH_URL } from './src/services/api/config';
import { tokens } from './src/theme/tokens';

/**
 * DEMO-00 placeholder.
 *
 * It pings the backend's health endpoint rather than rendering static text, so this screen proves
 * the two halves of the project actually reach each other — which is the part of the scaffolding
 * most likely to be quietly broken (wrong host, CORS, port). Replaced by the real Splash screen
 * and RootNavigator in Phase 1.
 *
 * Fonts (Fraunces / Inter / IBM Plex Mono) are not loaded yet, so this deliberately uses only the
 * size, weight, color and spacing tokens — not `fontFamily`. Applying a font family before the
 * font files exist just silently falls back to the system face and hides the gap.
 */

type HealthState = 'checking' | 'ok' | 'unreachable';

export default function App() {
  const [health, setHealth] = useState<HealthState>('checking');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(HEALTH_URL, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { status?: string }) => {
        if (!cancelled) setHealth(body.status === 'ok' ? 'ok' : 'unreachable');
      })
      .catch(() => {
        if (!cancelled) setHealth('unreachable');
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>SwipeHire</Text>
        <Text style={styles.tagline}>Mutual intent, not mass applications.</Text>

        <View style={styles.statusRow}>
          {health === 'checking' ? (
            <ActivityIndicator color={tokens.color.textSecondary} />
          ) : (
            <View
              style={[
                styles.dot,
                { backgroundColor: health === 'ok' ? tokens.color.success : tokens.color.error },
              ]}
            />
          )}
          <Text style={styles.statusText}>
            {health === 'checking' && 'Contacting backend…'}
            {health === 'ok' && 'Backend reachable'}
            {health === 'unreachable' && 'Backend unreachable'}
          </Text>
        </View>

        <Text style={styles.origin}>{API_ORIGIN}</Text>
      </View>

      <Text style={styles.footer}>DEMO-00 · scaffolding</Text>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  wordmark: {
    fontSize: tokens.typography.scale.displayL.fontSize,
    lineHeight: tokens.typography.scale.displayL.lineHeight,
    fontWeight: tokens.typography.scale.displayL.fontWeight,
    color: tokens.color.textPrimary,
  },
  tagline: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.scale.bodyM.fontSize,
    lineHeight: tokens.typography.scale.bodyM.lineHeight,
    color: tokens.color.textSecondary,
    textAlign: 'center',
  },
  statusRow: {
    marginTop: tokens.spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
  },
  dot: {
    width: tokens.spacing.sm,
    height: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
  },
  statusText: {
    fontSize: tokens.typography.scale.bodyM.fontSize,
    lineHeight: tokens.typography.scale.bodyM.lineHeight,
    color: tokens.color.textPrimary,
  },
  origin: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.scale.caption.fontSize,
    lineHeight: tokens.typography.scale.caption.lineHeight,
    color: tokens.color.textSecondary,
  },
  footer: {
    position: 'absolute',
    bottom: tokens.spacing.xl,
    fontSize: tokens.typography.scale.caption.fontSize,
    color: tokens.color.textSecondary,
  },
});
