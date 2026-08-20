import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';
import { type } from '../theme/typography';

/**
 * Tab bar label, with an optional unread count beside it.
 *
 * React Navigation's built-in `tabBarBadge` anchors to the icon, and this tab bar has no icons —
 * hiding the icon slot left the badge with nothing to position against, so it never appeared.
 * Rendering it as part of the label is both more reliable and the right shape for a typographic
 * tab bar: the count sits next to the word rather than floating above nothing.
 *
 * Indigo, not the platform's red. Red on the navy chrome reads as an error, and Frontend Spec §0
 * rules out red as a primary colour anyway.
 */

export interface TabLabelProps {
  label: string;
  focused: boolean;
  count?: number;
}

export function TabLabel({ label, focused, count }: TabLabelProps) {
  const showCount = typeof count === 'number' && count > 0;

  return (
    <View
      style={styles.row}
      accessibilityLabel={showCount ? `${label}, ${count} unread` : label}
    >
      <Text style={[type('caption'), focused ? styles.labelActive : styles.label]}>{label}</Text>

      {showCount && (
        <View style={styles.badge}>
          {/* Capped so a long-running demo can't stretch the tab and shove the others sideways. */}
          <Text style={[type('caption'), styles.badgeLabel]}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  label: { color: tokens.color.textInverse, opacity: 0.55 },
  labelActive: { color: tokens.color.textInverse },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { color: tokens.color.textInverse, fontSize: 11, lineHeight: 14 },
});
