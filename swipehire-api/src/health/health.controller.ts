import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Health endpoints. Deliberately unauthenticated and outside the `/api` prefix so Railway/Render
 * health checks (DEMO-20) can hit them without credentials.
 *
 * Split into two on purpose: `/health` answers "is this process alive" and must never depend on
 * anything external, or a database blip gets the container killed and restarted into the same
 * blip. `/health/ready` answers "can this process actually serve traffic" and does touch the
 * database.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'swipehire-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'reachable',
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      // The underlying error can carry the connection string; it goes to logs, never to the
      // response (Demo Security Baseline §1 — safe error messages).
      return { status: 'degraded', database: 'unreachable' };
    }
  }
}
