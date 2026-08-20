import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RealtimeGateway } from './realtime.gateway';

/**
 * Global so any module can push to a user without re-importing this one, and so there is exactly
 * one Socket.io server rather than one per importer.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
