import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { matchesApi } from '../services/api/endpoints';
import { useSocketEvent } from '../services/socket';

/**
 * Total unread messages across every match, for the Matches tab badge.
 *
 * Demo PRD §2 row 16 replaces real push with "toast/badge when the app is foregrounded". Without
 * this, a message arriving while the user is on the deck produced nothing visible at all — the
 * matches list only refreshed if you happened to be looking at it.
 *
 * Reuses the `['matches']` query rather than adding an endpoint: the count is already in that
 * payload, and sharing the key means the badge and the list can never disagree.
 */
export function useUnreadCount(): number {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['matches'],
    queryFn: matchesApi.list,
    // Cheap, and it keeps the badge honest if a socket event is ever missed.
    refetchInterval: 30_000,
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['matches'] });
  }, [qc]);

  // Mounted at the navigator, so these fire wherever the user is in the app.
  useSocketEvent('message:new', refresh);
  useSocketEvent('match:created', refresh);
  useSocketEvent('message:read', refresh);

  return (data ?? []).reduce((total, match) => total + match.unreadCount, 0);
}
