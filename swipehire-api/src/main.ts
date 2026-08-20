import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Demo Security Baseline §1 — reject malformed requests before they reach business logic.
  // `forbidNonWhitelisted` makes an unexpected field a 400 rather than something silently ignored,
  // which is what catches client/server drift early while both sides are still being built.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Demo Security Baseline §1 — CORS locked to known origins, never wide open "because it's a demo".
  // Native React Native requests don't enforce CORS at all, so this only governs Expo web and any
  // browser-based tooling; the point is that the deployed backend doesn't answer arbitrary origins.
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const devDefaults = ['http://localhost:8081', 'http://localhost:19006'];
  const origins = configured.length
    ? configured
    : process.env.NODE_ENV === 'production'
      ? []
      : devDefaults;

  app.enableCors({ origin: origins.length ? origins : false, credentials: true });

  // `/health` stays at the root so platform health checks (DEMO-20) hit a stable, prefix-free path.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = Number(process.env.PORT ?? 3000);
  // Bind 0.0.0.0 so a phone on the same LAN can reach the dev server during Expo Go testing.
  await app.listen(port, '0.0.0.0');

  Logger.log(`swipehire-api listening on :${port}`, 'Bootstrap');
  if (!origins.length) {
    Logger.warn('CORS_ORIGINS is unset in production — all cross-origin requests will be refused.', 'Bootstrap');
  }
}

void bootstrap();
