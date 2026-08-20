import 'dotenv/config';
import { Client } from 'pg';

/**
 * DEMO-03 acceptance check. Requires the server to be running:
 *
 *   npm run start:dev
 *   npx ts-node scripts/verify-auth.ts
 *
 * Drives the real HTTP surface rather than calling AuthService directly, so the global
 * ValidationPipe, the guard and the status codes are all covered — those are exactly the layers a
 * unit test would skip and a client would then hit.
 *
 * Creates one throwaway account per run and deletes it at the end.
 */

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const API = `${BASE}/api`;
const email = `verify-${Date.now()}@swipehire.test`;
const password = 'correct-horse-battery';

let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function main() {
  console.log(`base: ${BASE}\naccount: ${email}\n`);

  // --- signup -------------------------------------------------------------
  const signup = await post('/auth/signup', { email, password, role: 'candidate' });
  check('signup returns 201', signup.status === 201, `got ${signup.status}`);
  check('signup returns an access token', typeof signup.body?.accessToken === 'string');
  check('signup returns a refresh token', typeof signup.body?.refreshToken === 'string');
  check('signup echoes the role', signup.body?.user?.role === 'candidate');
  check('signup never returns the password hash', !JSON.stringify(signup.body).includes('passwordHash'));

  const { accessToken, refreshToken } = signup.body ?? {};

  // --- duplicate signup ---------------------------------------------------
  const dupe = await post('/auth/signup', { email, password, role: 'candidate' });
  check('duplicate signup returns 409', dupe.status === 409, `got ${dupe.status}`);

  // --- protected route ----------------------------------------------------
  const meOk = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  check('GET /auth/me with a token returns 200', meOk.status === 200, `got ${meOk.status}`);
  const meBody = await meOk.json().catch(() => null);
  check('GET /auth/me returns the right user', meBody?.email === email);

  const meAnon = await fetch(`${API}/auth/me`);
  check('GET /auth/me without a token returns 401', meAnon.status === 401, `got ${meAnon.status}`);

  const meBad = await fetch(`${API}/auth/me`, { headers: { Authorization: 'Bearer not.a.token' } });
  check('GET /auth/me with a junk token returns 401', meBad.status === 401, `got ${meBad.status}`);

  // --- login --------------------------------------------------------------
  const good = await post('/auth/login', { email, password });
  check('login with the right password returns 200', good.status === 200, `got ${good.status}`);

  const t0 = Date.now();
  const wrongPw = await post('/auth/login', { email, password: 'wrong-password-here' });
  const wrongPwMs = Date.now() - t0;

  const t1 = Date.now();
  const noUser = await post('/auth/login', { email: 'nobody@swipehire.test', password });
  const noUserMs = Date.now() - t1;

  check('wrong password returns 401', wrongPw.status === 401, `got ${wrongPw.status}`);
  check('unknown email returns 401', noUser.status === 401, `got ${noUser.status}`);
  check(
    'both failures return the SAME message (no account enumeration)',
    wrongPw.body?.message === noUser.body?.message,
    `"${wrongPw.body?.message}" vs "${noUser.body?.message}"`,
  );
  console.log(`         timing: wrong-password ${wrongPwMs}ms · unknown-email ${noUserMs}ms`);

  // --- validation ---------------------------------------------------------
  const shortPw = await post('/auth/signup', { email: 'x@y.test', password: 'short', role: 'candidate' });
  check('password under 8 chars is rejected', shortPw.status === 400, `got ${shortPw.status}`);

  const badRole = await post('/auth/signup', { email: 'x2@y.test', password, role: 'admin' });
  check('an unknown role is rejected', badRole.status === 400, `got ${badRole.status}`);

  const extraField = await post('/auth/login', { email, password, isAdmin: true });
  check('an undeclared field is rejected (whitelist)', extraField.status === 400, `got ${extraField.status}`);

  // --- refresh / logout ---------------------------------------------------
  const refreshed = await post('/auth/refresh', { refreshToken });
  check('refresh returns a new access token', refreshed.status === 200 && !!refreshed.body?.accessToken, `got ${refreshed.status}`);

  const logout = await post('/auth/logout', { refreshToken });
  check('logout returns 204', logout.status === 204, `got ${logout.status}`);

  const afterLogout = await post('/auth/refresh', { refreshToken });
  check(
    'refresh AFTER logout is rejected (session really ended)',
    afterLogout.status === 401,
    `got ${afterLogout.status}`,
  );

  const logoutAgain = await post('/auth/logout', { refreshToken });
  check('logout is idempotent', logoutAgain.status === 204, `got ${logoutAgain.status}`);

  // --- cleanup ------------------------------------------------------------
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const del = await db.query('DELETE FROM users WHERE email = $1', [email]);
  await db.end();
  console.log(`\ncleanup: removed ${del.rowCount} test user`);

  console.log(failures === 0 ? '\nDEMO-03 acceptance: PASS' : `\nDEMO-03 acceptance: FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nverify-auth crashed:', err.message);
  process.exit(1);
});
