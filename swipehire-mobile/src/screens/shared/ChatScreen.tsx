import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '../../components/chat/ChatBubble';
import { InterviewSlotCard } from '../../components/chat/InterviewSlotCard';
import { MatchOutcomeSheet } from '../../components/chat/MatchOutcomeSheet';
import { ProposeInterviewSheet } from '../../components/chat/ProposeInterviewSheet';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ListSkeleton } from '../../components/feedback/LoadingState';
import { MatchSeal } from '../../components/swipe/MatchSeal';
import { ApiError } from '../../services/api/client';
import { chatApi, interviewApi, matchesApi } from '../../services/api/endpoints';
import { useSocketEvent } from '../../services/socket';
import { useAuth } from '../../store/auth';
import { tokens } from '../../theme/tokens';
import { type } from '../../theme/typography';
import type { ChatMessage, InterviewSlot, MatchSummary, UserRole } from '../../types';
import { formatRelativeTime } from '../../utils/format';

/**
 * The conversation — Frontend Spec §9, shared by both roles, and where the second half of the demo
 * journey happens: chat, then interview scheduling, then the outcome.
 *
 * Everything hangs off the match id, because a match *is* the thread. There is no conversation
 * entity anywhere, and no way into this screen except through a match both parties created.
 */

export interface ChatScreenProps {
  matchId: string;
  role: UserRole;
  onBack: () => void;
}

export function ChatScreen({ matchId, role, onBack }: ChatScreenProps) {
  const qc = useQueryClient();
  const myId = useAuth((s) => s.user?.id);

  const [draft, setDraft] = useState('');
  const [proposeOpen, setProposeOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const messagesQuery = useQuery({
    queryKey: ['messages', matchId],
    queryFn: () => chatApi.history(matchId),
  });

  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    // The list endpoint carries the counterparty name and status this screen needs; the single-match
    // endpoint returns the raw row without them.
    queryFn: async () => (await matchesApi.list()).find((m) => m.id === matchId) ?? null,
  });

  const interviewQuery = useQuery({
    queryKey: ['interview', matchId],
    queryFn: () => interviewApi.get(matchId),
  });

  const match = matchQuery.data;
  const interview = interviewQuery.data;
  const isClosed = match ? match.status !== 'active' : false;

  // ---- live updates -------------------------------------------------------

  const onIncoming = useCallback(
    (message: ChatMessage) => {
      if (message.matchId !== matchId) return;

      qc.setQueryData(['messages', matchId], (prev: { items: ChatMessage[]; nextCursor: string | null } | undefined) => {
        if (!prev) return prev;
        // The sender receives its own message back too, so a naive append would double it.
        if (prev.items.some((m) => m.id === message.id)) return prev;
        return { ...prev, items: [message, ...prev.items] };
      });

      void qc.invalidateQueries({ queryKey: ['matches'] });
      if (message.senderId !== myId) void chatApi.markRead(matchId).catch(() => undefined);
    },
    [matchId, myId, qc],
  );

  useSocketEvent<ChatMessage>('message:new', onIncoming);
  useSocketEvent('interview:proposed', useCallback(() => void interviewQuery.refetch(), [interviewQuery]));
  useSocketEvent('interview:confirmed', useCallback(() => void interviewQuery.refetch(), [interviewQuery]));
  useSocketEvent('match:outcome', useCallback(() => void matchQuery.refetch(), [matchQuery]));

  // Opening the thread is what clears the badge.
  useEffect(() => {
    void chatApi.markRead(matchId).then(() => qc.invalidateQueries({ queryKey: ['matches'] })).catch(() => undefined);
  }, [matchId, qc]);

  // ---- actions ------------------------------------------------------------

  const send = useMutation({
    mutationFn: (content: string) => chatApi.send(matchId, content),
    // No optimistic insert: the socket echoes the sent message straight back, so adding it here
    // too would mean reconciling a temporary id against the real one for no visible gain.
    onSuccess: (message) => onIncoming(message),
  });

  const propose = useMutation({
    mutationFn: (slots: InterviewSlot[]) => interviewApi.propose(matchId, slots),
    onSuccess: (data) => {
      qc.setQueryData(['interview', matchId], data);
      setProposeOpen(false);
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Could not send those times'),
  });

  const accept = useMutation({
    mutationFn: (slotIndex: number) => interviewApi.accept(matchId, slotIndex),
    onSuccess: (data) => qc.setQueryData(['interview', matchId], data),
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Could not confirm that slot'),
  });

  const setOutcome = useMutation({
    mutationFn: ({ outcome, note }: { outcome: 'hired' | 'not_selected'; note?: string }) =>
      matchesApi.setOutcome(matchId, outcome, note),
    onSuccess: () => {
      setOutcomeOpen(false);
      setActionError(null);
      void matchQuery.refetch();
      void qc.invalidateQueries({ queryKey: ['matches'] });
      void qc.invalidateQueries({ queryKey: ['jobs', 'mine'] });
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Could not update the outcome'),
  });

  function submitDraft() {
    const content = draft.trim();
    if (!content || send.isPending) return;
    setDraft('');
    send.mutate(content);
  }

  // ---- render -------------------------------------------------------------

  if (messagesQuery.isPending || matchQuery.isPending) return <ListSkeleton rows={6} />;

  if (messagesQuery.isError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState title="Couldn't load this conversation" onRetry={() => void messagesQuery.refetch()} />
      </SafeAreaView>
    );
  }

  const messages = messagesQuery.data?.items ?? [];
  const lastSentId = messages.find((m) => m.senderId === myId)?.id;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ChatHeader match={match} onBack={onBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          // Inverted so new messages appear at the bottom without scrolling maths, and so the
          // header slot lands below the newest message — which is where the interview card belongs.
          inverted
          contentContainerStyle={styles.messages}
          ListHeaderComponent={
            <View>
              {interview && (
                <InterviewSlotCard
                  interview={interview}
                  role={role}
                  busy={accept.isPending}
                  onAccept={(index) => accept.mutate(index)}
                />
              )}
              {match?.outcomeNote && (
                <ChatBubble variant="system" content={`Feedback: ${match.outcomeNote}`} />
              )}
              {isClosed && (
                <ChatBubble
                  variant="system"
                  content={match?.status === 'archived' ? 'Hired — this match is archived' : 'This match is closed'}
                />
              )}
              {actionError && <Text style={[type('caption'), styles.actionError]}>{actionError}</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <ChatBubble
              variant={item.senderId === myId ? 'sent' : 'received'}
              content={item.content}
              timestamp={formatRelativeTime(item.sentAt)}
              readReceipt={item.id === lastSentId && item.readAt !== null}
            />
          )}
          ListFooterComponent={
            <ChatBubble variant="system" content="You matched. Say hello." />
          }
        />

        {role === 'recruiter' && !isClosed && (
          <View style={styles.recruiterActions}>
            {interview?.status !== 'confirmed' && (
              <Pressable
                onPress={() => setProposeOpen(true)}
                accessibilityRole="button"
                style={styles.actionChip}
              >
                <Text style={[type('button'), styles.actionChipLabel]}>Propose interview times</Text>
              </Pressable>
            )}
            {interview?.status === 'confirmed' && (
              <Pressable
                onPress={() => setOutcomeOpen(true)}
                accessibilityRole="button"
                style={styles.actionChip}
              >
                <Text style={[type('button'), styles.actionChipLabel]}>Update outcome</Text>
              </Pressable>
            )}
          </View>
        )}

        {isClosed ? (
          <View style={styles.closedNotice}>
            <Text style={[type('bodyM'), styles.closedText]}>
              This conversation is closed. The history stays here.
            </Text>
          </View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message"
              placeholderTextColor={tokens.color.textSecondary}
              style={[type('bodyL'), styles.input]}
              multiline
              maxLength={2000}
              accessibilityLabel="Message"
            />
            <Pressable
              onPress={submitDraft}
              disabled={!draft.trim() || send.isPending}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={[styles.send, (!draft.trim() || send.isPending) && styles.sendDisabled]}
            >
              <Text style={[type('button'), styles.sendLabel]}>Send</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <ProposeInterviewSheet
        visible={proposeOpen}
        busy={propose.isPending}
        error={actionError}
        onClose={() => setProposeOpen(false)}
        onSubmit={(slots) => propose.mutate(slots)}
      />

      <MatchOutcomeSheet
        visible={outcomeOpen}
        candidateName={match?.counterparty.name ?? ''}
        jobTitle={match?.job.title ?? ''}
        busy={setOutcome.isPending}
        error={actionError}
        onClose={() => setOutcomeOpen(false)}
        onSubmit={(outcome, note) => setOutcome.mutate({ outcome, note })}
      />
    </SafeAreaView>
  );
}

function ChatHeader({ match, onBack }: { match: MatchSummary | null | undefined; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
        <Text style={[type('button'), styles.back]}>Back</Text>
      </Pressable>

      <View style={styles.headerTitle}>
        <Text style={[type('h3'), styles.headerName]} numberOfLines={1}>
          {match?.counterparty.name ?? 'Conversation'}
        </Text>
        <Text style={[type('caption'), styles.headerJob]} numberOfLines={1}>
          {match?.job.title}
          {match?.job.companyName ? ` · ${match.job.companyName}` : ''}
        </Text>
      </View>

      <MatchSeal matchPercent={match?.matchScore ?? 0} size="sm" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  back: { color: tokens.color.primary },
  headerTitle: { flex: 1 },
  headerName: { color: tokens.color.textPrimary },
  headerJob: { color: tokens.color.textSecondary },
  messages: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.md },
  actionError: { color: tokens.color.error, textAlign: 'center', marginVertical: tokens.spacing.sm },
  recruiterActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  actionChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primaryTint,
  },
  actionChipLabel: { color: tokens.color.primary },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: tokens.color.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    color: tokens.color.textPrimary,
  },
  send: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primary,
  },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { color: tokens.color.textInverse },
  closedNotice: {
    padding: tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  closedText: { color: tokens.color.textSecondary, textAlign: 'center' },
});
