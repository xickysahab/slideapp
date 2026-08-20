import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

/**
 * Resume upload + parsing acceptance check. Requires the server to be running.
 *
 *   npm run start:dev
 *   npx ts-node scripts/verify-resume.ts <path-to-resume.pdf>
 *
 * Walks the real two-step handshake — ask for a signed URL, PUT the file to storage, then ask the
 * server to parse it — because the interesting failures live in the seams between those steps, not
 * inside the parser.
 */

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const API = `${BASE}/api`;
const pdfPath = process.argv[2];
const stamp = Date.now();
const candidateEmail = `res-${stamp}@swipehire.test`;
const otherEmail = `res-other-${stamp}@swipehire.test`;
const password = 'correct-horse-battery';

if (!pdfPath) {
  console.error('usage: ts-node scripts/verify-resume.ts <path-to-resume.pdf>');
  process.exit(1);
}

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
  if (res.status !== 201) throw new Error(`signup failed: ${res.status}`);
  return res.body.accessToken as string;
}

async function uploadTo(url: string, bytes: Buffer) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const pdf = readFileSync(pdfPath);
  console.log(`base: ${BASE}\nresume: ${pdfPath} (${pdf.length} bytes)\n`);

  const token = await signup(candidateEmail, 'candidate');
  const otherToken = await signup(otherEmail, 'candidate');
  await call('PATCH', '/profile', { fullName: 'Aditi Kulkarni' }, token);

  // --- happy path ----------------------------------------------------------
  const signed = await call('POST', '/resume/upload-url', {}, token);
  check('upload-url returns a signed URL', signed.status === 200 && !!signed.body?.uploadUrl, `got ${signed.status}`);
  const key = signed.body?.key as string;
  check('key is namespaced under the caller', typeof key === 'string' && key.includes('/'));

  await uploadTo(signed.body.uploadUrl, pdf);

  const parsed = await call('POST', '/resume/parse', { key }, token);
  check('parse returns 200', parsed.status === 200, `got ${parsed.status} ${JSON.stringify(parsed.body)}`);
  check('text was extracted', (parsed.body?.textLength ?? 0) > 100, `${parsed.body?.textLength} chars`);
  check('skills were found', (parsed.body?.skills?.length ?? 0) > 0, JSON.stringify(parsed.body?.skills));
  console.log(`         skills: ${JSON.stringify(parsed.body?.skills)}`);

  const profile = await call('GET', '/profile/me', undefined, token);
  check(
    'skills persisted to the candidate profile',
    JSON.stringify(profile.body?.candidate?.skills) === JSON.stringify(parsed.body?.skills),
  );

  const dl = await call('GET', '/resume/download-url', undefined, token);
  check('download-url returns a signed URL', dl.status === 200 && !!dl.body?.url, `got ${dl.status}`);
  const fetched = await fetch(dl.body.url);
  check('the signed URL actually serves the file', fetched.status === 200, `got ${fetched.status}`);
  const bytes = Buffer.from(await fetched.arrayBuffer());
  check('bytes match what was uploaded', bytes.equals(pdf));

  // --- ownership -----------------------------------------------------------
  const stolen = await call('POST', '/resume/parse', { key }, otherToken);
  check(
    "another candidate cannot parse someone else's key (404)",
    stolen.status === 404,
    `got ${stolen.status}`,
  );

  const traversal = await call('POST', '/resume/parse', { key: '../../etc/passwd' }, token);
  check('a traversal-shaped key is rejected (400)', traversal.status === 400, `got ${traversal.status}`);

  // --- content sniffing ----------------------------------------------------
  const fakeSigned = await call('POST', '/resume/upload-url', {}, token);
  await uploadTo(fakeSigned.body.uploadUrl, Buffer.from('This is plainly not a PDF at all.', 'utf8'));
  const fake = await call('POST', '/resume/parse', { key: fakeSigned.body.key }, token);
  check(
    'a non-PDF is rejected on content, not on its declared type (400)',
    fake.status === 400,
    `got ${fake.status} ${JSON.stringify(fake.body?.message)}`,
  );

  // --- role gate -----------------------------------------------------------
  const recruiterToken = await signup(`rec-${stamp}@swipehire.test`, 'recruiter');
  const recruiterTry = await call('POST', '/resume/upload-url', {}, recruiterToken);
  check('a recruiter has no resume endpoint (403)', recruiterTry.status === 403, `got ${recruiterTry.status}`);

  // --- delete --------------------------------------------------------------
  const del = await call('DELETE', '/resume', undefined, token);
  check('delete returns 204', del.status === 204, `got ${del.status}`);
  const afterDelete = await call('GET', '/resume/download-url', undefined, token);
  check('download after delete returns 404', afterDelete.status === 404, `got ${afterDelete.status}`);
  const skillsKept = await call('GET', '/profile/me', undefined, token);
  check(
    'deleting the file keeps hand-editable skills',
    (skillsKept.body?.candidate?.skills?.length ?? 0) > 0,
  );

  // --- cleanup -------------------------------------------------------------
  const emails = [candidateEmail, otherEmail, `rec-${stamp}@swipehire.test`];
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const removed = await db.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
  await db.end();
  console.log(`\ncleanup: removed ${removed.rowCount} test users`);

  console.log(failures === 0 ? '\nResume pipeline: PASS' : `\nResume pipeline: FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nverify-resume crashed:', err.message);
  process.exit(1);
});
