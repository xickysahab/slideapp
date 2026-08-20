import { Controller, Get } from '@nestjs/common';

/**
 * Liveness endpoint. Deliberately unauthenticated and outside the `/api` prefix so Railway/Render
 * health checks (DEMO-20) can hit it without credentials. It reports nothing about the database or
 * any other dependency on purpose — a readiness check lands with DEMO-01, once there is a database
 * connection worth reporting on.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'swipehire-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
