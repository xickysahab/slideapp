import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { dataSourceOptions } from './config/data-source';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { JobModule } from './modules/job/job.module';
import { SwipeMatchModule } from './modules/swipe-match/swipe-match.module';
import { ChatModule } from './modules/chat/chat.module';
import { InterviewModule } from './modules/interview/interview.module';
import { ResumeModule } from './modules/resume/resume.module';

/**
 * Module layout mirrors docs/SwipeHire-DEMO-Architecture.md §2. The feature modules are empty
 * skeletons at DEMO-00 — each gets filled in by its own ticket (see the header comment in each
 * module file). They are registered here from the start so the boundaries are visible and a later
 * ticket has an obvious place to land.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    // Migrations are run explicitly via `npm run migration:run`, never on boot — a deploy should
    // not be able to alter the schema as a side effect of restarting.
    TypeOrmModule.forRoot(dataSourceOptions),
    HealthModule,
    AuthModule,
    ProfileModule,
    JobModule,
    SwipeMatchModule,
    ChatModule,
    InterviewModule,
    ResumeModule,
  ],
})
export class AppModule {}
