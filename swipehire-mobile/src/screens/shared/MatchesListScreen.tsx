import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ListSkeleton } from '../../components/feedback/LoadingState';
import { MatchSeal } from '../../components/swipe/MatchSeal';
import { useSocketEvent } from '../../services/socket';
import { matchesApi } from '../../services/api/endpoints';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { MatchSummary, UserRole } from '../../types';
import { formatRelativeTime, initials } from '../../utils/format';

/**
 * Matches list — Frontend Spec §9, shared by both roles.
 *
 * FlatList rather than the spec's FlashList: cell recycling earns its dependency over hundreds of
 * rows, and a match list is a handful. Worth revisiting if this ever grows.
 */

export interface MatchesListScreenProps {
  role: UserRole;
  onOpenMatch: (matchId: string) => void;
}

export function MatchesListScreen({ role, onOpenMatch }: MatchesListScreenProps) {
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ['matches'],
    queryFn: matchesApi.list,
  });

  // A message or a new match arriving while this screen is open should update it, not wait for a
  // pull-to-refresh.
  useSocketEvent('message:new', () => void refetch());
  useSocketEvent('match:created', () => void refetch());
  useSocketEvent('match:outcome', () => void refetch());

  if (isPending) return <ListSkeleton />;

  if (isError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState title="Couldn't load your matches" onRetry={() => void refetch()} />
      </SafeAreaView>
    );
  }

  const matches = data ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={[type('h3'), styles.title]}>Matches</Text>
      </View>

      {matches.length === 0 ? (
        <EmptyState
          title="No matches yet"
          body={
            role === 'candidate'
              ? "When a recruiter shortlists you for a role you're interested in, it lands here."
              : 'When a candidate you shortlisted is also interested in the role, it lands here.'
          }
        />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <MatchRow match={item} onPress={() => onOpenMatch(item.id)} />}
        />
      )}
    </SafeAreaView>
  );
}

function MatchRow({ match, onPress }: { match: MatchSummary; onPress: () => void }) {
  const [first, ...rest] = match.counterparty.name.split(' ');
  const monogram = initials(first ?? '?', rest[rest.length - 1] ?? '');
  const closed = match.status !== 'active';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${match.counterparty.name}, ${match.job.title}${match.unreadCount ? `, ${match.unreadCount} unread` : ''}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.avatar, closed && styles.avatarClosed]}>
        <Text style={[type('caption'), styles.avatarLabel]}>{monogram}</Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[type('h3'), styles.name]} numberOfLines={1}>
            {match.counterparty.name}
          </Text>
          {match.lastMessage && (
            <Text style={[type('dataS'), styles.time]}>
              {formatRelativeTime(match.lastMessage.sentAt)}
            </Text>
          )}
        </View>

        <Text style={[type('bodyM'), styles.job]} numberOfLines={1}>
          {match.job.title}
          {match.job.companyName ? ` · ${match.job.companyName}` : ''}
        </Text>

        <View style={styles.rowBottom}>
          <Text style={[type('bodyM'), styles.preview]} numberOfLines={1}>
            {match.lastMessage
              ? `${match.lastMessage.fromMe ? 'You: ' : ''}${match.lastMessage.content}`
              : 'No messages yet'}
          </Text>

          {match.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={[type('caption'), styles.badgeLabel]}>{match.unreadCount}</Text>
            </View>
          )}
        </View>

        {closed && (
          <Text style={[type('caption'), styles.status]}>
            {match.status === 'archived' ? 'Hired — archived' : 'Closed'}
          </Text>
        )}
      </View>

      <MatchSeal matchPercent={match.matchScore ?? 0} size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  header: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.md },
  title: { color: tokens.color.textPrimary },
  list: { paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl },
  separator: { height: 1, backgroundColor: tokens.color.border, marginVertical: tokens.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, paddingVertical: tokens.spacing.sm },
  rowPressed: { opacity: 0.6 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClosed: { backgroundColor: tokens.color.surfaceAlt },
  avatarLabel: { color: tokens.color.primary },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: tokens.spacing.sm },
  name: { color: tokens.color.textPrimary, flexShrink: 1 },
  time: { color: tokens.color.textSecondary },
  job: { color: tokens.color.textSecondary },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  preview: { color: tokens.color.textSecondary, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { color: tokens.color.textInverse },
  status: { color: tokens.color.textSecondary, marginTop: 2 },
});
