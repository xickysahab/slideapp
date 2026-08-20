import 'dotenv/config';
import { Client } from 'pg';

/**
 * Job management + discovery acceptance check. Requires the server to be running.
 *
 *   npm run start:dev
 *   npx ts-node scripts/verify-jobs-discovery.ts
 *
 * Covers the loop the recruiter dashboard depends on: post a listing, see it in your own list,
 * have candidates ranked against it, and stay out of every other recruiter's data.
 */

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const API = `${BASE}/api`;
const stamp = Date.now();
const password = 'correct-horse-battery';

const emails = {
  recruiter: `jr-rec-${stamp}@swipehire.test`,
  otherRecruiter: `jr-rec2-${stamp}@swipehire.test`,
  strong: `jr-strong-${stamp}@swipehire.test`,
  partial: `jr-partial-${stamp}@swipehire.test`,
  weak: `jr-weak-${stamp}@swipehire.test`,
};

let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function signup(email: string, role: 'candidate' | 'recruiter') {
  const res = await call('POST', '/auth/signup', { email, password, role });
  if (res.status !== 201) throw new Error(`signup ${email} failed: ${res.status}`);
  return res.body.accessToken as string;
}

async function makeCandidate(email: string, fullName: string, skills: string[], years: number) {
  const token = await signup(email, 'candidate');
  await call('PATCH', '/profile', { fullName, locationCity: 'Bengaluru', skills, yearsExperience: years }, token);
  return token;
}

async function main() {
  console.log(`base: ${BASE}\n`);

  const recruiter = await signup(emails.recruiter, 'recruiter');
  const otherRecruiter = await signup(emails.otherRecruiter, 'recruiter');
  await call('PATCH', '/profile', { fullName: 'Rahul Mehta' }, recruiter);
  await call('PATCH', '/profile', { fullName: 'Other Recruiter' }, otherRecruiter);

  // --- posting requires a company first -----------------------------------
  const beforeCompany = await call('POST', '/jobs', { title: 'Backend Engineer', techStack: ['Node.js'] }, recruiter);
  check('posting before company setup returns 404 with guidance', beforeCompany.status === 404, `got ${beforeCompany.status}`);

  await call('PUT', '/profile/company', { name: 'Razorpay', industry: 'Fintech' }, recruiter);
  await call('PUT', '/profile/company', { name: 'Other Co' }, otherRecruiter);

  // --- create --------------------------------------------------------------
  const created = await call(
    'POST',
    '/jobs',
    {
      title: 'Senior Backend Engineer',
      description: 'Own the payments ledger service.',
      techStack: ['Node.js', 'Postgres', 'AWS', 'Kafka'],
      compMin: 1_800_000,
      compMax: 2_800_000,
      locationCity: 'Bengaluru',
      workMode: 'remote',
      experienceMinYears: 4,
    },
    recruiter,
  );
  check('recruiter can post a job', created.status === 201, `got ${created.status}`);
  check('job is attached to the recruiter’s own company', !!created.body?.companyId);
  const jobId = created.body?.id as string;

  const badRange = await call('POST', '/jobs', { title: 'Bad pay', techStack: ['Node.js'], compMin: 900, compMax: 100 }, recruiter);
  check('compMin above compMax is rejected', badRange.status === 400, `got ${badRange.status}`);

  const noStack = await call('POST', '/jobs', { title: 'No stack', techStack: [] }, recruiter);
  check('a job with an empty tech stack is rejected', noStack.status === 400, `got ${noStack.status}`);

  // --- the dashboard -------------------------------------------------------
  const mine = await call('GET', '/jobs/mine', undefined, recruiter);
  check('dashboard lists the recruiter’s jobs', mine.status === 200 && mine.body?.length === 1, `got ${mine.status}, ${mine.body?.length} jobs`);

  const othersDashboard = await call('GET', '/jobs/mine', undefined, otherRecruiter);
  check('another recruiter’s dashboard is empty', othersDashboard.body?.length === 0, `${othersDashboard.body?.length} jobs`);

  // --- ownership on writes -------------------------------------------------
  const foreignEdit = await call('PATCH', `/jobs/${jobId}`, { title: 'Hijacked' }, otherRecruiter);
  check('another recruiter cannot edit the job (404)', foreignEdit.status === 404, `got ${foreignEdit.status}`);

  const foreignDeck = await call('GET', `/discover/candidates?jobId=${jobId}`, undefined, otherRecruiter);
  check('another recruiter cannot open the job’s deck (404)', foreignDeck.status === 404, `got ${foreignDeck.status}`);

  // --- candidates ----------------------------------------------------------
  const strong = await makeCandidate(emails.strong, 'Aditi Kulkarni', ['Node.js', 'Postgres', 'AWS', 'Kafka'], 6);
  await makeCandidate(emails.partial, 'Rohan Malhotra', ['Node.js', 'Postgres'], 3);
  await makeCandidate(emails.weak, 'Priya Venkatesan', ['Figma'], 1);

  const deck = await call('GET', `/discover/candidates?jobId=${jobId}`, undefined, recruiter);
  check('recruiter deck returns candidates', deck.status === 200 && deck.body?.items?.length >= 3, `got ${deck.status}, ${deck.body?.items?.length} items`);

  const items = deck.body?.items ?? [];
  const scores = items.map((c: { matchScore: number }) => c.matchScore);
  check('scores are ranked best first', JSON.stringify(scores) === JSON.stringify([...scores].sort((a: number, b: number) => b - a)), JSON.stringify(scores));
  check('scores actually differ between candidates', new Set(scores).size > 1, JSON.stringify(scores));

  // --- blind-first, enforced server-side -----------------------------------
  const payload = JSON.stringify(items);
  check('deck exposes first name and last initial', items[0]?.firstName?.length > 0 && items[0]?.lastInitial?.length === 1, JSON.stringify({ f: items[0]?.firstName, l: items[0]?.lastInitial }));
  check('surnames are absent from the payload', !payload.includes('Kulkarni') && !payload.includes('Malhotra') && !payload.includes('Venkatesan'));
  check('email addresses are absent from the payload', !payload.includes('@swipehire.test'));
  check('resume keys are absent from the payload', !payload.includes('.pdf'));
  check('presence of a resume is still signalled', typeof items[0]?.hasResume === 'boolean');

  // --- candidate side ------------------------------------------------------
  const jobsFeed = await call('GET', '/discover/jobs', undefined, strong);
  check('candidate deck returns jobs', jobsFeed.status === 200 && jobsFeed.body?.items?.length >= 1, `got ${jobsFeed.status}`);
  const card = jobsFeed.body?.items?.find((j: { id: string }) => j.id === jobId);
  check('the posted job appears on the candidate deck', !!card);
  check('the card carries a match score', typeof card?.matchScore === 'number', String(card?.matchScore));
  check('the card lists which skills matched', Array.isArray(card?.matchedSkills) && card.matchedSkills.length === 4, JSON.stringify(card?.matchedSkills));
  check('the card does not leak which recruiter posted it', !JSON.stringify(card).includes('recruiterId'));
  check('the verified badge is carried', card?.companyVerified === true);

  const candidateBrowsingCandidates = await call('GET', `/discover/candidates?jobId=${jobId}`, undefined, strong);
  check('a candidate cannot open a candidate deck (403)', candidateBrowsingCandidates.status === 403, `got ${candidateBrowsingCandidates.status}`);

  const recruiterBrowsingJobs = await call('GET', '/discover/jobs', undefined, recruiter);
  check('a recruiter cannot open the job deck (403)', recruiterBrowsingJobs.status === 403, `got ${recruiterBrowsingJobs.status}`);

  // --- closing a listing ---------------------------------------------------
  const filled = await call('PATCH', `/jobs/${jobId}/status`, { status: 'filled' }, recruiter);
  check('recruiter can mark a job filled', filled.status === 200 && filled.body?.status === 'filled', `got ${filled.status}`);

  const afterFilled = await call('GET', '/discover/jobs', undefined, strong);
  check(
    'a filled job leaves the candidate deck',
    !afterFilled.body?.items?.some((j: { id: string }) => j.id === jobId),
  );

  const stillMine = await call('GET', '/jobs/mine', undefined, recruiter);
  check('but stays on the recruiter’s own dashboard', stillMine.body?.length === 1);

  const candidateFetchFilled = await call('GET', `/jobs/${jobId}`, undefined, strong);
  check('and is 404 for a candidate fetching it directly', candidateFetchFilled.status === 404, `got ${candidateFetchFilled.status}`);

  // --- cleanup -------------------------------------------------------------
  const all = Object.values(emails);
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query('DELETE FROM jobs WHERE recruiter_id IN (SELECT id FROM users WHERE email = ANY($1))', [all]);
  await db.query('DELETE FROM recruiter_profiles WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))', [all]);
  await db.query("DELETE FROM companies WHERE name IN ('Razorpay', 'Other Co')");
  const removed = await db.query('DELETE FROM users WHERE email = ANY($1)', [all]);
  await db.end();
  console.log(`\ncleanup: removed ${removed.rowCount} test users`);

  console.log(failures === 0 ? '\nJobs + discovery: PASS' : `\nJobs + discovery: FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nverify-jobs-discovery crashed:', err.message);
  process.exit(1);
});
