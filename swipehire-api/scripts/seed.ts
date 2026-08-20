import { hash as argonHash } from '@node-rs/argon2';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { CandidateProfile } from '../src/database/entities/candidate-profile.entity';
import { Company } from '../src/database/entities/company.entity';
import { Interview } from '../src/database/entities/interview.entity';
import { Job } from '../src/database/entities/job.entity';
import { Match } from '../src/database/entities/match.entity';
import { Message } from '../src/database/entities/message.entity';
import { Profile } from '../src/database/entities/profile.entity';
import { RecruiterProfile } from '../src/database/entities/recruiter-profile.entity';
import { Swipe } from '../src/database/entities/swipe.entity';
import { User } from '../src/database/entities/user.entity';
import { computeMatch } from '../src/shared/matching/match-score';

/**
 * Demo seed data.
 *
 *   npx ts-node scripts/seed.ts
 *
 * Demo PRD §4 calls this the single most important addition for a convincing demo, and it is not
 * wrong: an empty deck ends the conversation before the product gets a chance. It is treated here
 * as a feature, not a fixture.
 *
 * What it guarantees, all from §4:
 *   - a populated deck on both sides, 18 jobs and 18 candidates
 *   - match scores that visibly differ card to card, because a deck where everything reads 90%+
 *     looks fabricated
 *   - one pre-arranged mutual match, so "It's a Match!" fires on the very first right-swipe of the
 *     walkthrough rather than being a matter of luck
 *   - one match already mid-conversation, so the chat screen isn't empty when it's opened
 *   - one match in each terminal state, so the matches list shows the whole lifecycle
 *
 * Re-runnable: it clears everything it previously created (recognised by the @swipehire.demo
 * address) before inserting, so it can be run against a database that already has a demo in it.
 */

const DEMO_DOMAIN = 'swipehire.demo';
const DEMO_PASSWORD = 'swipehire2026';

const email = (handle: string) => `${handle}@${DEMO_DOMAIN}`;

// ---------------------------------------------------------------------------
// Source data
// ---------------------------------------------------------------------------

const COMPANIES = [
  { handle: 'razorpay', name: 'Razorpay', industry: 'Fintech', recruiter: 'Rahul Mehta' },
  { handle: 'zerodha', name: 'Zerodha', industry: 'Fintech', recruiter: 'Nithin Rao' },
  { handle: 'swiggy', name: 'Swiggy', industry: 'Consumer', recruiter: 'Sneha Iyer' },
  { handle: 'postman', name: 'Postman', industry: 'Developer Tools', recruiter: 'Abhinav Asthana' },
  { handle: 'cred', name: 'CRED', industry: 'Fintech', recruiter: 'Kunal Shah' },
];

interface JobSeed {
  company: string;
  title: string;
  description: string;
  techStack: string[];
  compMin: number | null;
  compMax: number | null;
  locationCity: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  experienceMinYears: number;
}

const JOBS: JobSeed[] = [
  // The guaranteed-match job sits first and is tuned to the demo candidate's exact stack.
  { company: 'razorpay', title: 'Senior Backend Engineer', description: "Own the payments infra team's core ledger service, processing 40M transactions a day. You'll lead the migration off the legacy settlement pipeline.", techStack: ['Node.js', 'TypeScript', 'Postgres', 'AWS'], compMin: 1_800_000, compMax: 2_800_000, locationCity: 'Bengaluru', workMode: 'remote', experienceMinYears: 4 },
  { company: 'razorpay', title: 'Platform Engineer', description: 'Build the internal deployment platform every product team ships through. Kubernetes, and the tooling that makes it invisible.', techStack: ['Golang', 'Kubernetes', 'Terraform', 'AWS'], compMin: 2_000_000, compMax: 3_000_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 5 },
  { company: 'razorpay', title: 'Frontend Engineer, Dashboard', description: 'The merchant dashboard is where 8 lakh businesses see their money. Make it fast and make it clear.', techStack: ['React', 'TypeScript', 'Redux'], compMin: 1_500_000, compMax: 2_400_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 3 },
  { company: 'razorpay', title: 'Data Engineer', description: 'Own the pipelines behind settlement reconciliation. Correctness matters more than latency, and both matter.', techStack: ['Python', 'Spark', 'Airflow', 'SQL'], compMin: 1_600_000, compMax: 2_500_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 3 },

  { company: 'zerodha', title: 'Backend Engineer, Trading', description: 'Work on the order-matching path that clears a fifth of Indian retail equity volume. Latency is the product.', techStack: ['Golang', 'Postgres', 'Redis'], compMin: 2_200_000, compMax: 3_200_000, locationCity: 'Bengaluru', workMode: 'onsite', experienceMinYears: 4 },
  { company: 'zerodha', title: 'Site Reliability Engineer', description: 'Markets open at 09:15 and do not wait. Keep the platform up, and fix what wakes you.', techStack: ['Kubernetes', 'Prometheus', 'Grafana', 'Linux', 'Terraform'], compMin: 1_900_000, compMax: 2_900_000, locationCity: 'Bengaluru', workMode: 'onsite', experienceMinYears: 5 },
  { company: 'zerodha', title: 'Mobile Engineer, Kite', description: 'Kite is how ten million people check the market before it opens. Performance work is measured in dropped frames.', techStack: ['React Native', 'TypeScript', 'iOS', 'Android'], compMin: 1_700_000, compMax: 2_600_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 3 },
  { company: 'zerodha', title: 'Quant Developer', description: 'Build and backtest strategies for the internal desk. Python for research, C++ where it needs to be quick.', techStack: ['Python', 'NumPy', 'Pandas', 'C++'], compMin: 2_500_000, compMax: 4_000_000, locationCity: 'Bengaluru', workMode: 'onsite', experienceMinYears: 4 },

  { company: 'swiggy', title: 'Backend Engineer, Delivery', description: 'Dispatch decides which rider gets which order, ten thousand times a minute. Own that service.', techStack: ['Java', 'Kafka', 'Postgres', 'Redis'], compMin: 1_600_000, compMax: 2_600_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 3 },
  { company: 'swiggy', title: 'Machine Learning Engineer', description: 'Own the demand-forecasting models behind delivery-time estimates. Terabyte-scale batch plus a streaming path that cannot fall behind.', techStack: ['Python', 'PyTorch', 'Spark', 'Airflow', 'Machine Learning'], compMin: 2_000_000, compMax: 3_400_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 4 },
  { company: 'swiggy', title: 'Frontend Engineer', description: 'Ship the ordering flow that most of urban India uses at 8pm. Small teams, weekly releases.', techStack: ['React', 'TypeScript', 'Next.js'], compMin: 1_400_000, compMax: 2_200_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 2 },
  { company: 'swiggy', title: 'Engineering Manager, Payments', description: 'Lead a team of nine across two payment products. Hands-on enough to review a schema change, senior enough to own the roadmap.', techStack: ['Java', 'Postgres', 'System Design', 'Microservices'], compMin: null, compMax: null, locationCity: 'Bengaluru', workMode: 'onsite', experienceMinYears: 8 },

  { company: 'postman', title: 'Backend Engineer, API Platform', description: 'Work on the collection-sync engine used by 30 million developers. Correctness under concurrent edits is the hard part, and the interesting one.', techStack: ['Node.js', 'TypeScript', 'Postgres', 'Docker'], compMin: 2_000_000, compMax: 3_000_000, locationCity: 'Bengaluru', workMode: 'remote', experienceMinYears: 4 },
  { company: 'postman', title: 'Developer Advocate Engineer', description: 'Half engineering, half teaching. Build the samples, then explain why they work.', techStack: ['JavaScript', 'Node.js', 'REST API', 'GraphQL'], compMin: 1_500_000, compMax: 2_300_000, locationCity: 'Bengaluru', workMode: 'remote', experienceMinYears: 3 },
  { company: 'postman', title: 'Infrastructure Engineer', description: 'Multi-region, multi-tenant, and a free tier that dwarfs the paid one. Make the economics work.', techStack: ['AWS', 'Terraform', 'Kubernetes', 'Golang'], compMin: 2_100_000, compMax: 3_100_000, locationCity: 'Bengaluru', workMode: 'remote', experienceMinYears: 5 },

  { company: 'cred', title: 'Full Stack Engineer', description: 'Ship member-facing features end to end on a product where the design bar is the point.', techStack: ['React', 'TypeScript', 'Node.js', 'GraphQL'], compMin: 1_600_000, compMax: 2_400_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 2 },
  { company: 'cred', title: 'iOS Engineer', description: 'The app is the brand. Build it in Swift, and argue about the animation curves.', techStack: ['Swift', 'SwiftUI', 'iOS'], compMin: 1_800_000, compMax: 2_800_000, locationCity: 'Bengaluru', workMode: 'hybrid', experienceMinYears: 3 },
  { company: 'cred', title: 'Security Engineer', description: 'Credit data, payment rails, and a member base that notices. Own the threat model.', techStack: ['Linux', 'Python', 'AWS', 'System Design'], compMin: 2_200_000, compMax: 3_500_000, locationCity: 'Bengaluru', workMode: 'onsite', experienceMinYears: 6 },
];

interface CandidateSeed {
  handle: string;
  fullName: string;
  currentTitle: string;
  headline: string;
  skills: string[];
  years: number;
  city: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  salaryMin: number;
  salaryMax: number;
  notice: number;
}

const CANDIDATES: CandidateSeed[] = [
  { handle: 'aditi', fullName: 'Aditi Kulkarni', currentTitle: 'Senior Backend Engineer', headline: 'Payments and ledger systems at scale', skills: ['Node.js', 'TypeScript', 'Postgres', 'AWS', 'Redis', 'Docker'], years: 6, city: 'Bengaluru', workMode: 'remote', salaryMin: 2_000_000, salaryMax: 3_000_000, notice: 60 },
  { handle: 'rohan', fullName: 'Rohan Malhotra', currentTitle: 'Backend Engineer', headline: 'Node and Postgres, checkout systems', skills: ['Node.js', 'TypeScript', 'MongoDB', 'Docker'], years: 3, city: 'Pune', workMode: 'hybrid', salaryMin: 1_400_000, salaryMax: 2_000_000, notice: 30 },
  { handle: 'meera', fullName: 'Meera Subramanian', currentTitle: 'Platform Engineer', headline: 'Kubernetes and the tooling around it', skills: ['Golang', 'Kubernetes', 'Terraform', 'AWS', 'Prometheus'], years: 7, city: 'Hyderabad', workMode: 'remote', salaryMin: 2_400_000, salaryMax: 3_400_000, notice: 90 },
  { handle: 'karthik', fullName: 'Karthik Raman', currentTitle: 'Full Stack Engineer', headline: 'React front to Postgres back', skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'Postgres'], years: 4, city: 'Chennai', workMode: 'onsite', salaryMin: 1_600_000, salaryMax: 2_300_000, notice: 60 },
  { handle: 'ananya', fullName: 'Ananya Bose', currentTitle: 'Data Engineer', headline: 'Batch and streaming pipelines', skills: ['Python', 'Airflow', 'SQL', 'Spark'], years: 3, city: 'Bengaluru', workMode: 'hybrid', salaryMin: 1_500_000, salaryMax: 2_200_000, notice: 30 },
  { handle: 'devansh', fullName: 'Devansh Pillai', currentTitle: 'Mobile Engineer', headline: 'React Native, 60fps or it ships again', skills: ['React Native', 'TypeScript', 'iOS', 'Android'], years: 7, city: 'Mumbai', workMode: 'remote', salaryMin: 2_200_000, salaryMax: 3_000_000, notice: 60 },
  { handle: 'ishita', fullName: 'Ishita Nair', currentTitle: 'ML Engineer', headline: 'Forecasting and ranking models in production', skills: ['Python', 'PyTorch', 'Machine Learning', 'Spark', 'Airflow'], years: 5, city: 'Bengaluru', workMode: 'hybrid', salaryMin: 2_400_000, salaryMax: 3_600_000, notice: 60 },
  { handle: 'vikram', fullName: 'Vikram Deshpande', currentTitle: 'Site Reliability Engineer', headline: 'On-call, and fixing what causes it', skills: ['Kubernetes', 'Prometheus', 'Grafana', 'Linux', 'Terraform'], years: 8, city: 'Bengaluru', workMode: 'onsite', salaryMin: 2_300_000, salaryMax: 3_300_000, notice: 90 },
  { handle: 'priya', fullName: 'Priya Venkatesan', currentTitle: 'Frontend Engineer', headline: 'Design systems and the details', skills: ['React', 'TypeScript', 'Next.js', 'Figma', 'CSS'], years: 4, city: 'Bengaluru', workMode: 'hybrid', salaryMin: 1_500_000, salaryMax: 2_300_000, notice: 30 },
  { handle: 'arjun', fullName: 'Arjun Sethi', currentTitle: 'Backend Engineer', headline: 'Java and Kafka, high-throughput services', skills: ['Java', 'Kafka', 'Postgres', 'Redis', 'Microservices'], years: 5, city: 'Bengaluru', workMode: 'hybrid', salaryMin: 1_900_000, salaryMax: 2_700_000, notice: 60 },
  { handle: 'sanjana', fullName: 'Sanjana Reddy', currentTitle: 'iOS Engineer', headline: 'Swift, and arguing about animation curves', skills: ['Swift', 'SwiftUI', 'iOS'], years: 4, city: 'Hyderabad', workMode: 'hybrid', salaryMin: 1_800_000, salaryMax: 2_600_000, notice: 45 },
  { handle: 'nikhil', fullName: 'Nikhil Chawla', currentTitle: 'Quant Developer', headline: 'Research in Python, execution in C++', skills: ['Python', 'NumPy', 'Pandas', 'C++'], years: 5, city: 'Mumbai', workMode: 'onsite', salaryMin: 2_800_000, salaryMax: 4_200_000, notice: 90 },
  { handle: 'tara', fullName: 'Tara Ghosh', currentTitle: 'Security Engineer', headline: 'Threat modelling for payment systems', skills: ['Linux', 'Python', 'AWS', 'System Design'], years: 6, city: 'Bengaluru', workMode: 'onsite', salaryMin: 2_400_000, salaryMax: 3_400_000, notice: 60 },
  { handle: 'harsh', fullName: 'Harsh Vardhan', currentTitle: 'Junior Backend Engineer', headline: 'Two years in, learning fast', skills: ['Node.js', 'Express', 'MongoDB'], years: 2, city: 'Delhi', workMode: 'remote', salaryMin: 900_000, salaryMax: 1_400_000, notice: 30 },
  { handle: 'lakshmi', fullName: 'Lakshmi Menon', currentTitle: 'Engineering Manager', headline: 'Nine engineers, two payment products', skills: ['Java', 'Postgres', 'System Design', 'Microservices', 'Agile'], years: 11, city: 'Bengaluru', workMode: 'onsite', salaryMin: 4_000_000, salaryMax: 6_000_000, notice: 90 },
  { handle: 'zoya', fullName: 'Zoya Khan', currentTitle: 'DevOps Engineer', headline: 'CI/CD that people actually like using', skills: ['Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions', 'AWS'], years: 4, city: 'Pune', workMode: 'remote', salaryMin: 1_700_000, salaryMax: 2_500_000, notice: 45 },
  { handle: 'rahulg', fullName: 'Rahul Gopinath', currentTitle: 'Backend Engineer', headline: 'Go services and Postgres', skills: ['Golang', 'Postgres', 'Redis', 'Docker'], years: 4, city: 'Bengaluru', workMode: 'onsite', salaryMin: 1_900_000, salaryMax: 2_800_000, notice: 60 },
  { handle: 'neha', fullName: 'Neha Bhatt', currentTitle: 'Data Analyst', headline: 'SQL, dashboards, and asking better questions', skills: ['SQL', 'Python', 'Tableau', 'Power BI'], years: 3, city: 'Ahmedabad', workMode: 'hybrid', salaryMin: 1_100_000, salaryMax: 1_700_000, notice: 30 },
];

// ---------------------------------------------------------------------------

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ds = app.get(DataSource);

  const users = ds.getRepository(User);
  const profiles = ds.getRepository(Profile);
  const candidateProfiles = ds.getRepository(CandidateProfile);
  const companies = ds.getRepository(Company);
  const recruiterProfiles = ds.getRepository(RecruiterProfile);
  const jobs = ds.getRepository(Job);
  const swipes = ds.getRepository(Swipe);
  const matches = ds.getRepository(Match);
  const messages = ds.getRepository(Message);
  const interviews = ds.getRepository(Interview);

  console.log('clearing previous demo data…');
  await clearDemoData(ds);

  const passwordHash = await argonHash(DEMO_PASSWORD);

  // ---- recruiters and companies ------------------------------------------
  const companyByHandle = new Map<string, Company>();
  const recruiterByHandle = new Map<string, User>();

  for (const c of COMPANIES) {
    const user = await users.save(users.create({ email: email(`hr.${c.handle}`), passwordHash, role: 'recruiter' }));
    await profiles.save(profiles.create({ userId: user.id, fullName: c.recruiter, locationCity: 'Bengaluru' }));

    const company = await companies.save(
      companies.create({ name: c.name, industry: c.industry, verified: true, logoUrl: null }),
    );
    await recruiterProfiles.save(recruiterProfiles.create({ userId: user.id, companyId: company.id }));

    companyByHandle.set(c.handle, company);
    recruiterByHandle.set(c.handle, user);
  }
  console.log(`  ${COMPANIES.length} companies with recruiters`);

  // ---- jobs ---------------------------------------------------------------
  const createdJobs: Job[] = [];
  for (const j of JOBS) {
    const company = companyByHandle.get(j.company)!;
    const recruiter = recruiterByHandle.get(j.company)!;

    createdJobs.push(
      await jobs.save(
        jobs.create({
          companyId: company.id,
          recruiterId: recruiter.id,
          title: j.title,
          description: j.description,
          techStack: j.techStack,
          compMin: j.compMin,
          compMax: j.compMax,
          locationCity: j.locationCity,
          workMode: j.workMode,
          experienceMinYears: j.experienceMinYears,
          status: 'active',
        }),
      ),
    );
  }
  console.log(`  ${createdJobs.length} jobs`);

  // ---- candidates ---------------------------------------------------------
  const candidateByHandle = new Map<string, User>();
  for (const c of CANDIDATES) {
    const user = await users.save(users.create({ email: email(c.handle), passwordHash, role: 'candidate' }));
    await profiles.save(profiles.create({ userId: user.id, fullName: c.fullName, locationCity: c.city }));
    await candidateProfiles.save(
      candidateProfiles.create({
        userId: user.id,
        headline: c.headline,
        currentTitle: c.currentTitle,
        yearsExperience: c.years,
        skills: c.skills,
        expectedSalaryMin: c.salaryMin,
        expectedSalaryMax: c.salaryMax,
        preferredWorkMode: c.workMode,
        noticePeriodDays: c.notice,
        resumeS3Key: null,
      }),
    );
    candidateByHandle.set(c.handle, user);
  }
  console.log(`  ${CANDIDATES.length} candidates`);

  // ---- the guaranteed match ----------------------------------------------
  /**
   * Demo PRD §4: the "It's a Match!" moment must fire on the very first right-swipe of the
   * walkthrough, not be a matter of luck.
   *
   * The Razorpay ledger role is the first job in the list and is tuned to Aditi's exact stack, so
   * it sorts to the top of her deck. Razorpay's recruiter has already right-swiped her for it —
   * which means her first right-swipe completes the mutual pair and the match fires live.
   *
   * Deliberately only the recruiter's half. Seeding both sides would create the match now and leave
   * nothing to happen on camera.
   */
  const aditi = candidateByHandle.get('aditi')!;
  const ledgerJob = createdJobs[0];
  await swipes.save(
    swipes.create({
      actorId: ledgerJob.recruiterId,
      targetId: aditi.id,
      targetType: 'candidate',
      direction: 'right',
      jobId: ledgerJob.id,
    }),
  );
  console.log(`  primed match: ${CANDIDATES[0].fullName} × "${ledgerJob.title}"`);

  // ---- a match already in conversation ------------------------------------
  const postmanJob = createdJobs.find((j) => j.title === 'Backend Engineer, API Platform')!;
  const chatMatch = await createMatch(ds, aditi.id, postmanJob);

  const thread = [
    { from: postmanJob.recruiterId, text: 'Hi Aditi — your ledger migration work lines up well with what we need on collection sync.', minsAgo: 190 },
    { from: aditi.id, text: 'Thanks for reaching out. Happy to talk — is the team distributed or Bengaluru-based?', minsAgo: 154 },
    { from: postmanJob.recruiterId, text: 'Fully distributed, with two weeks a year together. Would a call this week suit?', minsAgo: 96 },
  ];
  for (const m of thread) {
    await messages.save(
      messages.create({
        matchId: chatMatch.id,
        senderId: m.from,
        content: m.text,
        sentAt: new Date(Date.now() - m.minsAgo * 60_000),
        // The last message stays unread so the matches list shows a badge on first launch.
        readAt: m.minsAgo > 100 ? new Date(Date.now() - 90 * 60_000) : null,
      }),
    );
  }
  console.log(`  seeded conversation: 3 messages on "${postmanJob.title}"`);

  // ---- an interview already confirmed -------------------------------------
  const credJob = createdJobs.find((j) => j.title === 'Full Stack Engineer')!;
  const interviewMatch = await createMatch(ds, candidateByHandle.get('karthik')!.id, credJob);
  const slotStart = new Date(Date.now() + 2 * 86_400_000);
  slotStart.setHours(11, 0, 0, 0);
  const slotEnd = new Date(slotStart.getTime() + 45 * 60_000);
  await interviews.save(
    interviews.create({
      matchId: interviewMatch.id,
      proposedBy: credJob.recruiterId,
      proposedSlots: [{ start: slotStart.toISOString(), end: slotEnd.toISOString(), timezone: 'Asia/Kolkata' }],
      confirmedSlot: { start: slotStart.toISOString(), end: slotEnd.toISOString(), timezone: 'Asia/Kolkata' },
      status: 'confirmed',
    }),
  );
  console.log('  seeded confirmed interview');

  // ---- both terminal states ----------------------------------------------
  /**
   * So the matches list shows the whole lifecycle on first launch rather than an all-active list.
   * (Journey Map, DEMO-16b seed note.)
   */
  const hiredJob = createdJobs.find((j) => j.title === 'Frontend Engineer')!;
  const hiredMatch = await createMatch(ds, candidateByHandle.get('priya')!.id, hiredJob);
  await matches.update({ id: hiredMatch.id }, { status: 'archived' });
  await jobs.update({ id: hiredJob.id }, { status: 'filled' });

  const closedJob = createdJobs.find((j) => j.title === 'Data Engineer')!;
  // Given to the demo candidate rather than a bystander, so her matches list shows the full
  // lifecycle — two active, one closed with feedback — on first open. 'Hired' stays with Priya:
  // being hired ends a job search, which would read oddly on the account still swiping.
  const closedMatch = await createMatch(ds, aditi.id, closedJob);
  await matches.update(
    { id: closedMatch.id },
    { status: 'closed', outcomeNote: 'Strong on SQL and reporting — we needed more depth on Spark for this one. Please do apply again.' },
  );
  console.log('  seeded one hired and one closed match');

  // ---- summary ------------------------------------------------------------
  const sample = createdJobs.slice(0, 6).map((job) => {
    const { score } = computeMatch({
      candidateSkills: CANDIDATES[0].skills,
      jobTechStack: job.techStack,
      candidateYears: CANDIDATES[0].years,
      jobMinYears: job.experienceMinYears,
    });
    return `${score}% ${job.title}`;
  });

  console.log('\nAditi’s deck (top of list, showing the spread):');
  sample.forEach((s) => console.log(`  ${s}`));

  console.log('\nDemo accounts — password for all:', DEMO_PASSWORD);
  console.log(`  candidate  ${email('aditi')}      (first right-swipe on the Razorpay ledger role matches)`);
  console.log(`  recruiter  ${email('hr.razorpay')}`);
  console.log(`  recruiter  ${email('hr.postman')}  (has the seeded conversation)`);

  await app.close();
}

/** Creates a match directly, snapshotting the score the same way the live path does. */
async function createMatch(ds: DataSource, candidateId: string, job: Job): Promise<Match> {
  const candidate = await ds.getRepository(CandidateProfile).findOneOrFail({ where: { userId: candidateId } });
  const { score } = computeMatch({
    candidateSkills: candidate.skills,
    jobTechStack: job.techStack,
    candidateYears: candidate.yearsExperience,
    jobMinYears: job.experienceMinYears,
  });

  // Both underlying swipes are written too, so the seeded state is one the app could have reached
  // on its own — and so these cards don't reappear in either side's deck.
  const swipes = ds.getRepository(Swipe);
  await swipes.save(swipes.create({ actorId: candidateId, targetId: job.id, targetType: 'job', direction: 'right', jobId: null }));
  await swipes.save(swipes.create({ actorId: job.recruiterId, targetId: candidateId, targetType: 'candidate', direction: 'right', jobId: job.id }));

  const matches = ds.getRepository(Match);
  return matches.save(
    matches.create({ candidateId, recruiterId: job.recruiterId, jobId: job.id, matchScore: score, status: 'active' }),
  );
}

/**
 * Removes everything a previous run created, in dependency order.
 *
 * Scoped to the @swipehire.demo domain so a database that also holds real accounts — or the
 * throwaway users the verify scripts create — is left alone.
 */
async function clearDemoData(ds: DataSource): Promise<void> {
  const demoUsers: { id: string }[] = await ds.query(
    `SELECT id FROM users WHERE email LIKE $1`,
    [`%@${DEMO_DOMAIN}`],
  );
  if (demoUsers.length === 0) return;

  const ids = demoUsers.map((u) => u.id);

  await ds.query(`DELETE FROM interviews WHERE match_id IN (SELECT id FROM matches WHERE candidate_id = ANY($1) OR recruiter_id = ANY($1))`, [ids]);
  await ds.query(`DELETE FROM messages WHERE match_id IN (SELECT id FROM matches WHERE candidate_id = ANY($1) OR recruiter_id = ANY($1))`, [ids]);
  await ds.query(`DELETE FROM matches WHERE candidate_id = ANY($1) OR recruiter_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM swipes WHERE actor_id = ANY($1) OR target_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM jobs WHERE recruiter_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM recruiter_profiles WHERE user_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM companies WHERE id NOT IN (SELECT company_id FROM recruiter_profiles) AND id NOT IN (SELECT company_id FROM jobs)`);
  await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);

  console.log(`  removed ${ids.length} previous demo users and their data`);
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
