import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Job } from '../../database/entities/job.entity';
import type { UserRole } from '../../database/entities/user.entity';
import { ProfileService } from '../profile/profile.service';
import type { CreateJobDto, UpdateJobDto } from './dto/job.dto';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly profiles: ProfileService,
  ) {}

  /**
   * Posts a job under the caller's own company.
   *
   * The company is resolved from the recruiter's profile rather than taken from the request, so
   * there is no company id in the body to swap for someone else's.
   */
  async create(userId: string, role: UserRole, dto: CreateJobDto): Promise<Job> {
    this.assertRecruiter(role);
    this.assertCompRange(dto);

    // Throws a clear "set up your company first" if the recruiter skipped that step.
    const company = await this.profiles.getCompanyForRecruiter(userId);

    return this.jobs.save(
      this.jobs.create({
        companyId: company.id,
        recruiterId: userId,
        title: dto.title,
        description: dto.description ?? null,
        techStack: dto.techStack,
        compMin: dto.compMin ?? null,
        compMax: dto.compMax ?? null,
        locationCity: dto.locationCity ?? null,
        workMode: dto.workMode ?? null,
        experienceMinYears: dto.experienceMinYears ?? null,
        status: 'active',
      }),
    );
  }

  /**
   * The recruiter's own listings — this is what their dashboard renders.
   *
   * Scoped to `recruiterId` from the token, so it can only ever return the caller's jobs. Newest
   * first: the thing you just posted should be the thing you see.
   */
  async listMine(userId: string, role: UserRole): Promise<Job[]> {
    this.assertRecruiter(role);

    return this.jobs.find({
      where: { recruiterId: userId },
      relations: { company: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * A single job.
   *
   * Readable by anyone signed in — candidates need it for the job-details screen. Only active jobs
   * are visible to candidates; a recruiter can always see their own, including filled ones.
   */
  async findOne(jobId: string, viewerId: string, role: UserRole): Promise<Job> {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!job) throw new NotFoundException('Job not found');

    const isOwner = job.recruiterId === viewerId;
    if (!isOwner && job.status !== 'active') {
      // 404 rather than 403: "exists but not visible to you" and "doesn't exist" must look the
      // same from outside (Demo Security Baseline §1).
      throw new NotFoundException('Job not found');
    }

    // A candidate has no business knowing which recruiter account posted a listing pre-match.
    if (!isOwner) job.recruiterId = undefined as unknown as string;

    return job;
  }

  async update(jobId: string, userId: string, role: UserRole, dto: UpdateJobDto): Promise<Job> {
    this.assertRecruiter(role);
    const job = await this.loadOwned(jobId, userId);

    this.assertCompRange({
      compMin: dto.compMin ?? job.compMin ?? undefined,
      compMax: dto.compMax ?? job.compMax ?? undefined,
    });

    Object.assign(job, {
      title: dto.title ?? job.title,
      description: dto.description ?? job.description,
      techStack: dto.techStack ?? job.techStack,
      compMin: dto.compMin ?? job.compMin,
      compMax: dto.compMax ?? job.compMax,
      locationCity: dto.locationCity ?? job.locationCity,
      workMode: dto.workMode ?? job.workMode,
      experienceMinYears: dto.experienceMinYears ?? job.experienceMinYears,
    });

    return this.jobs.save(job);
  }

  /**
   * Opens or closes a listing.
   *
   * Marking a job 'filled' takes it out of every candidate's deck. There is no delete: 'filled' is
   * a real business state with its own meaning, which is why the schema uses a status enum rather
   * than a deleted_at column.
   */
  async setStatus(jobId: string, userId: string, role: UserRole, status: 'active' | 'filled'): Promise<Job> {
    this.assertRecruiter(role);
    const job = await this.loadOwned(jobId, userId);
    job.status = status;
    return this.jobs.save(job);
  }

  /** Used by the discovery feed and match scoring, which do their own visibility filtering. */
  async findActiveById(jobId: string): Promise<Job | null> {
    return this.jobs.findOne({ where: { id: jobId, status: 'active' }, relations: { company: true } });
  }

  /**
   * Loads a job the caller owns, or pretends it doesn't exist.
   *
   * Every write path goes through here rather than repeating the check, so there's one place to be
   * right about it (Demo Security Baseline §1).
   */
  private async loadOwned(jobId: string, userId: string): Promise<Job> {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!job || job.recruiterId !== userId) throw new NotFoundException('Job not found');
    return job;
  }

  private assertRecruiter(role: UserRole): void {
    if (role !== 'recruiter') throw new ForbiddenException('Only recruiters can manage job listings');
  }

  private assertCompRange(dto: { compMin?: number; compMax?: number }): void {
    if (dto.compMin !== undefined && dto.compMax !== undefined && dto.compMin > dto.compMax) {
      throw new BadRequestException('compMin cannot be greater than compMax');
    }
  }
}
