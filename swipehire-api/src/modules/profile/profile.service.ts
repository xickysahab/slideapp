import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CandidateProfile } from '../../database/entities/candidate-profile.entity';
import { Company } from '../../database/entities/company.entity';
import { Profile } from '../../database/entities/profile.entity';
import { RecruiterProfile } from '../../database/entities/recruiter-profile.entity';
import type { UserRole } from '../../database/entities/user.entity';
import type { UpdateProfileDto, UpsertCompanyDto } from './dto/profile.dto';

/** Fields on UpdateProfileDto that only mean something for a candidate. */
const CANDIDATE_ONLY_FIELDS = [
  'headline',
  'currentTitle',
  'yearsExperience',
  'skills',
  'expectedSalaryMin',
  'expectedSalaryMax',
  'preferredWorkMode',
  'noticePeriodDays',
] as const satisfies readonly (keyof UpdateProfileDto)[];

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(CandidateProfile) private readonly candidates: Repository<CandidateProfile>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(RecruiterProfile) private readonly recruiters: Repository<RecruiterProfile>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * The caller's own profile, assembled per role.
   *
   * Takes the user id from the authenticated principal, never from a parameter — there is no way to
   * ask this method for somebody else's profile, which is the cheapest form of the ownership check
   * Demo Security Baseline §1 requires.
   */
  async getMyProfile(userId: string, role: UserRole) {
    const basic = await this.profiles.findOne({ where: { userId } });

    if (role === 'candidate') {
      const candidate = await this.candidates.findOne({ where: { userId } });
      return { role, profile: basic, candidate };
    }

    const recruiter = await this.recruiters.findOne({
      where: { userId },
      relations: { company: true },
    });
    return { role, profile: basic, company: recruiter?.company ?? null };
  }

  /**
   * Creates or updates the caller's profile.
   *
   * Runs in one transaction: onboarding submits basic and candidate fields together from a single
   * screen, and a half-applied profile would leave the user looking complete on one screen and
   * empty on the next.
   */
  async updateProfile(userId: string, role: UserRole, dto: UpdateProfileDto) {
    const candidateFieldsSent = CANDIDATE_ONLY_FIELDS.filter((f) => dto[f] !== undefined);

    if (role !== 'candidate' && candidateFieldsSent.length > 0) {
      // Named explicitly rather than ignored. Silently dropping fields would let a client believe
      // it had saved something it hadn't — the kind of thing that surfaces mid-demo.
      throw new ForbiddenException(
        `These fields apply to candidates only: ${candidateFieldsSent.join(', ')}`,
      );
    }

    this.assertSalaryRange(dto);

    await this.dataSource.transaction(async (tx) => {
      const profileRepo = tx.getRepository(Profile);
      const existing = await profileRepo.findOne({ where: { userId } });

      if (!existing && dto.fullName === undefined) {
        // full_name is NOT NULL, so the very first write has to carry one. A clearer message than
        // whatever the driver would produce from the constraint violation.
        throw new BadRequestException('fullName is required when creating your profile');
      }

      await profileRepo.save(
        profileRepo.create({
          ...(existing ?? {}),
          userId,
          fullName: dto.fullName ?? existing?.fullName,
          locationCity: dto.locationCity ?? existing?.locationCity ?? null,
          avatarUrl: dto.avatarUrl ?? existing?.avatarUrl ?? null,
        }),
      );

      if (role !== 'candidate') return;

      const candidateRepo = tx.getRepository(CandidateProfile);
      const current = await candidateRepo.findOne({ where: { userId } });

      await candidateRepo.save(
        candidateRepo.create({
          ...(current ?? {}),
          userId,
          headline: dto.headline ?? current?.headline ?? null,
          currentTitle: dto.currentTitle ?? current?.currentTitle ?? null,
          yearsExperience: dto.yearsExperience ?? current?.yearsExperience ?? null,
          // Skills are replaced wholesale, not merged: the review-and-edit screen (Frontend Spec §2
          // candidate 8) exists so the user can REMOVE a wrongly-parsed skill, and a merge would
          // make removal impossible.
          skills: dto.skills ?? current?.skills ?? [],
          expectedSalaryMin: dto.expectedSalaryMin ?? current?.expectedSalaryMin ?? null,
          expectedSalaryMax: dto.expectedSalaryMax ?? current?.expectedSalaryMax ?? null,
          preferredWorkMode: dto.preferredWorkMode ?? current?.preferredWorkMode ?? null,
          noticePeriodDays: dto.noticePeriodDays ?? current?.noticePeriodDays ?? null,
        }),
      );
    });

    return this.getMyProfile(userId, role);
  }

  /**
   * Creates the recruiter's company on first call, updates it thereafter.
   *
   * The company is resolved through the caller's own recruiter_profiles row, so a recruiter can
   * only ever edit the company they're linked to — the request never names a company id, which
   * removes the class of bug where an id from the body is trusted.
   */
  async upsertCompany(userId: string, role: UserRole, dto: UpsertCompanyDto) {
    if (role !== 'recruiter') {
      throw new ForbiddenException('Only recruiters have a company profile');
    }

    return this.dataSource.transaction(async (tx) => {
      const companyRepo = tx.getRepository(Company);
      const linkRepo = tx.getRepository(RecruiterProfile);

      const link = await linkRepo.findOne({ where: { userId }, relations: { company: true } });

      if (link) {
        const company = link.company;
        company.name = dto.name;
        company.logoUrl = dto.logoUrl ?? company.logoUrl;
        company.industry = dto.industry ?? company.industry;
        return companyRepo.save(company);
      }

      const company = await companyRepo.save(
        companyRepo.create({
          name: dto.name,
          logoUrl: dto.logoUrl ?? null,
          industry: dto.industry ?? null,
          // Auto-verified for the demo (Demo PRD §2 rows 4 and 20). The badge shows; there is no
          // workflow behind it. Not client-settable — see UpsertCompanyDto.
          verified: true,
        }),
      );

      await linkRepo.save(linkRepo.create({ userId, companyId: company.id }));
      return company;
    });
  }

  /** Used by JobModule to resolve which company a recruiter posts under. */
  async getCompanyForRecruiter(userId: string): Promise<Company> {
    const link = await this.recruiters.findOne({
      where: { userId },
      relations: { company: true },
    });

    if (!link) {
      throw new NotFoundException('Set up your company profile before posting a job');
    }
    return link.company;
  }

  private assertSalaryRange(dto: UpdateProfileDto): void {
    const { expectedSalaryMin: min, expectedSalaryMax: max } = dto;
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException('expectedSalaryMin cannot be greater than expectedSalaryMax');
    }
  }
}
