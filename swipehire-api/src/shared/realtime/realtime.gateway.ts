import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import type { UserRole } from '../../database/entities/user.entity';

interface SocketUser {
  id: string;
  role: UserRole;
}

/**
 * The single Socket.io server for the whole app.
 *
 * Lives in `shared/` rather than inside ChatModule because two modules need to push to a user:
 * SwipeMatchModule fires `match:created`, ChatModule fires `message:new`. Having chat own the
 * server would force SwipeMatch to depend on ChatModule while ChatModule already depends on
 * SwipeMatch for match validation — a cycle, in exchange for nothing.
 *
 * No Redis adapter. Architecture §1: a single instance can't have a cross-instance fan-out problem,
 * and the adapter only starts mattering once there's horizontal scale to fan out across.
 *
 * Every connection is authenticated at handshake with the same access token the REST API uses.
 * Demo Security Baseline §1 has no cold-messaging path anywhere: an unauthenticated socket is
 * disconnected rather than left connected in a degraded state.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  // Kept off the default namespace so a stray connection to `/` doesn't look like a live client.
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: UserRole }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      const user: SocketUser = { id: payload.sub, role: payload.role };
      client.data.user = user;

      /**
       * Each user gets a private room named after their id. Emitting to `user:<id>` reaches every
       * device that user has open without the sender needing to know socket ids, and without any
       * broadcast that could reach the wrong person.
       */
      await client.join(this.userRoom(user.id));
      this.logger.debug(`socket connected: ${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data?.user as SocketUser | undefined;
    if (user) this.logger.debug(`socket disconnected: ${user.id}`);
  }

  /** Pushes an event to every device a user has connected. Silently no-ops if they're offline. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  /** Convenience for the two-party events — a match and a chat message both have exactly two. */
  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    for (const id of new Set(userIds)) this.emitToUser(id, event, payload);
  }

  /** True when the user has at least one live socket. Used to decide whether a push is redundant. */
  async isOnline(userId: string): Promise<boolean> {
    const sockets = await this.server?.in(this.userRoom(userId)).fetchSockets();
    return (sockets?.length ?? 0) > 0;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * React Native's Socket.io client can't set arbitrary headers on the websocket transport, so
   * `auth` is the primary channel and the header is a fallback for tooling that can.
   */
  private extractToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);

    return null;
  }
}
