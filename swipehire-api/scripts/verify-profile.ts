import 'dotenv/config';
import { Client } from 'pg';

/**
 * DEMO-04 acceptance check. Requires the server to be running.
 *
 *   npm run start:dev
 *   npx ts-node scripts/verify-profile.ts
 *
 * Creates one candidate and one recruiter, exercises the profile endpoints as both, and removes
 * them afterwards.
 */

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const API = `${BASE}/api`;
const stamp = Date.now();
const candidateEmail = `cand-${stamp}@swipehire.test`;
const recruiterEmail = `rec-${stamp}@swipehire.test`;
const password = 'correct-horse-battery';

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
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

async function main() {
  console.log(`base: ${BASE}\n`);

  const candidateToken = await signup(candidateEmail, 'candidate');
  const recruiterToken = await signup(recruiterEmail, 'recruiter');

  // --- auth gate -----------------------------------------------------------
  const anon = await call('GET', '/profile/me');
  check('GET /profile/me without a token returns 401', anon.status === 401, `got ${anon.status}`);

  // --- candidate -----------------------------------------------------------
  const noName = await call('PATCH', '/profile', { locationCity: 'Pune' }, candidateToken);
  check('first profile write without fullName returns 400', noName.status === 400, `got ${noName.status}`);

  const created = await call(
    'PATCH',
    '/profile',
    {
      fullName: 'Aditi Kulkarni',
      locationCity: 'Bengaluru',
      headline: 'Backend engineer, payments',
      currentTitle: 'Senior Backend Engineer',
      yearsExperience: 5,
      skills: ['Node.js', 'Postgres', 'AWS'],
      expectedSalaryMin: 1_800_000,
      expectedSalaryMax: 2_600_000,
      preferredWorkMode: 'remote',
      noticePeriodDays: 60,
    },
    candidateToken,
  );
  check('candidate profile saves', created.status === 200, `got ${created.status}`);
  check('basic fields persisted', created.body?.profile?.fullName === 'Aditi Kulkarni');
  check('candidate fields persisted', created.body?.candidate?.yearsExperience === 5);
  check('skills persisted', JSON.stringify(created.body?.candidate?.skills) === JSON.stringify(['Node.js', 'Postgres', 'AWS']));
  check('work mode persisted', created.body?.candidate?.preferredWorkMode === 'remote');

  const reread = await call('GET', '/profile/me', undefined, candidateToken);
  check('GET /profile/me returns what was written', reread.body?.candidate?.noticePeriodDays === 60);

  // Partial update must not wipe untouched fields.
  const partial = await call('PATCH', '/profile', { locationCity: 'Pune' }, candidateToken);
  check('partial update keeps fullName', partial.body?.profile?.fullName === 'Aditi Kulkarni');
  check('partial update applies the change', partial.body?.profile?.locationCity === 'Pune');
  check('partial update keeps skills', partial.body?.candidate?.skills?.length === 3);

  // Skills replace rather than merge — the review screen has to be able to remove a bad parse.
  const fewer = await call('PATCH', '/profile', { skills: ['Node.js'] }, candidateToken);
  check(
    'skills are replaced, not merged (removal works)',
    JSON.stringify(fewer.body?.candidate?.skills) === JSON.stringify(['Node.js']),
    JSON.stringify(fewer.body?.candidate?.skills),
  );

  const badRange = await call(
    'PATCH',
    '/profile',
    { expectedSalaryMin: 3_000_000, expectedSalaryMax: 1_000_000 },
    candidateToken,
  );
  check('salary min above max returns 400', badRange.status === 400, `got ${badRange.status}`);

  const candidateCompany = await call('PUT', '/profile/company', { name: 'Nope Inc' }, candidateToken);
  check('candidate cannot create a company (403)', candidateCompany.status === 403, `got ${candidateCompany.status}`);

  // --- recruiter -----------------------------------------------------------
  const recBasic = await call('PATCH', '/profile', { fullName: 'Rahul Mehta', locationCity: 'Bengaluru' }, recruiterToken);
  check('recruiter basic profile saves', recBasic.status === 200, `got ${recBasic.status}`);

  const recCandidateFields = await call('PATCH', '/profile', { yearsExperience: 9 }, recruiterToken);
  check('recruiter sending candidate fields returns 403', recCandidateFields.status === 403, `got ${recCandidateFields.status}`);

  const company = await call(
    'PUT',
    '/profile/company',
    { name: 'Razorpay', industry: 'Fintech' },
    recruiterToken,
  );
  check('company created', company.status === 200 && company.body?.name === 'Razorpay', `got ${company.status}`);
  check('company is auto-verified', company.body?.verified === true);
  const companyId = company.body?.id;

  const companyAgain = await call(
    'PUT',
    '/profile/company',
    { name: 'Razorpay Software', industry: 'Fintech' },
    recruiterToken,
  );
  check('second call updates rather than duplicating', companyAgain.body?.id === companyId, `${companyId} vs ${companyAgain.body?.id}`);
  check('company name updated', companyAgain.body?.name === 'Razorpay Software');

  const recMe = await call('GET', '/profile/me', undefined, recruiterToken);
  check('GET /profile/me returns the linked company', recMe.body?.company?.id === companyId);
  check('recruiter profile has no candidate block', recMe.body?.candidate === undefined);

  // A client cannot award itself the verified badge.
  const forged = await call('PUT', '/profile/company', { name: 'X', verified: false }, recruiterToken);
  check('undeclared field on company is rejected', forged.status === 400, `got ${forged.status}`);

  // --- cleanup -------------------------------------------------------------
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query('DELETE FROM recruiter_profiles WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))', [[candidateEmail, recruiterEmail]]);
  if (companyId) await db.query('DELETE FROM companies WHERE id = $1', [companyId]);
  const del = await db.query('DELETE FROM users WHERE email = ANY($1)', [[candidateEmail, recruiterEmail]]);
  await db.end();
  console.log(`\ncleanup: removed ${del.rowCount} test users`);

  console.log(failures === 0 ? '\nDEMO-04 acceptance: PASS' : `\nDEMO-04 acceptance: FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nverify-profile crashed:', err.message);
  process.exit(1);
});
