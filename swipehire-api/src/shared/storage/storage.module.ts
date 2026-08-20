import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service';

/**
 * Global so ResumeModule (and later, profile avatar handling) can inject StorageService without
 * each one re-importing it. Object storage is infrastructure, not a feature module — it owns no
 * tables and sits outside the module-ownership map in Demo Architecture §2.
 */
@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
