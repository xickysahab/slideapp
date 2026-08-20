import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../../store/auth';
import { API_ORIGIN } from '../api/config';

/**
 * The app's single Socket.io connection.
 *
 * A module-level singleton rather than context, because the connection has to outlive any screen:
 * a match arriving while the user is deep in the recruiter dashboard still needs to land, and
 * tearing the socket down on every navigation would drop exactly the events the demo depends on.
 *
 * Writes go over REST; this is delivery only. See docs/BACKEND.md §4 for the event list.
 */

let socket: Socket | null = null;
let connectedWithToken: string | null = null;

export function connectSocket(token: string): Socket {
  // Reuse the live connection unless the token actually changed — reconnecting on every render
  // would thrash the server and lose in-flight events.
  if (socket && connectedWithToken === token) return socket;

  socket?.close();

  socket = io(`${API_ORIGIN}/realtime`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  connectedWithToken = token;

  return socket;
}

export function disconnectSocket(): void {
  socket?.close();
  socket = null;
  connectedWithToken = null;
}

export function getSocket(): Socket | null {
  return socket;
}

/**
 * Keeps the connection in step with the session — connected while signed in, closed when not.
 *
 * Mounted once at the navigation root.
 */
export function useSocketConnection(): void {
  const accessToken = useAuth((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return;
    }

    connectSocket(accessToken);
    // Deliberately no cleanup: the socket is meant to survive re-renders and screen changes, and is
    // closed explicitly on logout or token loss by the branch above.
  }, [accessToken]);
}

/**
 * Subscribes to one server event for the lifetime of a component.
 *
 * The handler is stored in a ref-like closure captured per effect run, so a screen re-rendering
 * doesn't leak a listener — every subscription is removed when its effect tears down.
 */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void): void {
  useEffect(() => {
    const active = getSocket();
    if (!active) return;

    active.on(event, handler as (...args: unknown[]) => void);
    return () => {
      active.off(event, handler as (...args: unknown[]) => void);
    };
  }, [event, handler]);
}
