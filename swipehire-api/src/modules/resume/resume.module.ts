import { Module } from '@nestjs/common';

/**
 * ResumeModule — see docs/SwipeHire-DEMO-Architecture.md §2.
 *
 * Owns tables: none (writes skills via ProfileService)
 * Built in:    DEMO-05
 *
 * Module boundaries are kept identical to the full architecture doc on purpose: other modules
 * call this one's service interface, never its tables directly, even though this is a single
 * deployable. That boundary is what makes a later service extraction mechanical.
 */
@Module({})
export class ResumeModule {}
