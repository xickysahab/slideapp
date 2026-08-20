import 'dotenv/config';
import { Client } from 'pg';
import { io, type Socket } from 'socket.io-client';

/**
 * The whole demo journey, server side, in one run. Requires the server to be running.
 *
 *   npm run start:dev
 *   npx ts-node scripts/verify-loop.ts
 *
 * Walks Demo PRD §1 end to end — swipe, match, chat, interview, outcome — including the live socket
 * events, because "the other person's screen updates without a refresh" is the part of the demo a
 * REST assertion can't prove.
 */

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const API = `${BASE}/api`;
const stamp = Date.now();
const password = 'correct-horse-battery';

const emails = {
  recruiter: `loop-rec-${stamp}@swipehire.test`,
  candidate: `loop-cand-${stamp}@swipehire.test`,
  bystander: `loop-by-${stamp}@swipehire.test`,
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

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${BASE}/realtime`, { auth: { token }, transports: ['websocket'] });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
    setTimeout(() => reject(new Error('socket connect timed out')), 8000);
  });
}

/** Resolves with the next occurrence of `event`, or null if it doesn't arrive in time. */
function nextEvent<T>(socket: Socket, event: string, ms = 5000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function main() {
  console.log(`base: ${BASE}\n`);

  // ---- setup --------------------------------------------------------------
  const recruiter = await signup(emails.recruiter, 'recruiter');
  const candidate = await signup(emails.candidate, 'candidate');
  const bystander = await signup(emails.bystander, 'candidate');

  await call('PATCH', '/profile', { fullName: 'Rahul Mehta' }, recruiter);
  await call('PUT', '/profile/company', { name: 'Razorpay', industry: 'Fintech' }, recruiter);
  await call(
    'PATCH',
    '/profile',
    { fullName: 'Aditi Kulkarni', locationCity: 'Bengaluru', skills: ['Node.js', 'Postgres', 'AWS'], yearsExperience: 5 },
    candidate,
  );
  await call('PATCH', '/profile', { fullName: 'Some Bystander', skills: ['Figma'], yearsExperience: 1 }, bystander);

  const job = await call(
    'POST',
    '/jobs',
    { title: 'Senior Backend Engineer', techStack: ['Node.js', 'Postgres', 'AWS'], experienceMinYears: 4, workMode: 'remote' },
    recruiter,
  );
  const jobId = job.body?.id as string;
  check('setup: job posted', job.status === 201, `got ${job.status}`);

  // ---- sockets ------------------------------------------------------------
  const [candSocket, recSocket] = await Promise.all([connect(candidate), connect(recruiter)]);
  check('both clients connect to the realtime gateway', candSocket.connected && recSocket.connected);

  const rejected = await new Promise<boolean>((resolve) => {
    const bad = io(`${BASE}/realtime`, { auth: { token: 'not-a-token' }, transports: ['websocket'] });
    bad.once('disconnect', () => resolve(true));
    bad.once('connect_error', () => resolve(true));
    setTimeout(() => resolve(bad.connected === false), 4000);
  });
  check('an unauthenticated socket is refused', rejected);

  // ---- first swipe: no match yet ------------------------------------------
  const firstSwipe = await call('POST', '/swipes', { targetId: jobId, targetType: 'job', direction: 'right' }, candidate);
  check('candidate right-swipes the job', firstSwipe.status === 200, `got ${firstSwipe.status}`);
  check('no match on one-sided interest', firstSwipe.body?.matched === false, JSON.stringify(firstSwipe.body));

  const noMatchYet = await call('GET', '/matches', undefined, candidate);
  check('matches list is still empty', noMatchYet.body?.length === 0, `${noMatchYet.body?.length} matches`);

  // ---- reciprocal swipe: match --------------------------------------------
  const candWaits = nextEvent<{ matchId: string }>(candSocket, 'match:created');
  const recWaits = nextEvent<{ matchId: string }>(recSocket, 'match:created');

  const secondSwipe = await call(
    'POST',
    '/swipes',
    { targetId: (await call('GET', `/discover/candidates?jobId=${jobId}`, undefined, recruiter)).body.items.find((c: { firstName: string }) => c.firstName === 'Aditi').id, targetType: 'candidate', direction: 'right', jobId },
    recruiter,
  );
  check('recruiter right-swipes the candidate', secondSwipe.status === 200, `got ${secondSwipe.status}`);
  check('a mutual right-swipe produces a match', secondSwipe.body?.matched === true, JSON.stringify(secondSwipe.body));
  const matchId = secondSwipe.body?.matchId as string;

  const [candEvent, recEvent] = await Promise.all([candWaits, recWaits]);
  check('the candidate receives match:created live', candEvent?.matchId === matchId, JSON.stringify(candEvent));
  check('the recruiter receives match:created live', recEvent?.matchId === matchId, JSON.stringify(recEvent));

  const dupe = await call('POST', '/swipes', { targetId: jobId, targetType: 'job', direction: 'right' }, candidate);
  check('re-swiping does not create a second match', dupe.body?.matchId === matchId || dupe.body?.matched === true, JSON.stringify(dupe.body));

  const db0 = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db0.connect();
  const countRes = await db0.query('SELECT count(*)::int AS n FROM matches WHERE job_id = $1', [jobId]);
  check('exactly one match row exists', countRes.rows[0].n === 1, `${countRes.rows[0].n} rows`);
  await db0.end();

  // ---- there is no way to assert a match ----------------------------------
  const forged = await call('POST', '/matches', { candidateId: 'x', jobId }, recruiter);
  check('there is no endpoint to create a match directly', forged.status === 404, `got ${forged.status}`);

  const stranger = await call('GET', `/matches/${matchId}`, undefined, bystander);
  check('a non-participant cannot read the match (404)', stranger.status === 404, `got ${stranger.status}`);

  // ---- chat ---------------------------------------------------------------
  const recGetsMessage = nextEvent<{ content: string }>(recSocket, 'message:new');
  const sent = await call('POST', `/matches/${matchId}/messages`, { content: 'Hi Rahul — happy to talk about the ledger role.' }, candidate);
  check('candidate can send a message', sent.status === 201, `got ${sent.status}`);
  const delivered = await recGetsMessage;
  check('the recruiter receives it live', delivered?.content === 'Hi Rahul — happy to talk about the ledger role.', JSON.stringify(delivered));

  await call('POST', `/matches/${matchId}/messages`, { content: 'Great — are you free this week?' }, recruiter);

  const history = await call('GET', `/matches/${matchId}/messages`, undefined, candidate);
  check('history returns both messages', history.body?.items?.length === 2, `${history.body?.items?.length} messages`);

  const strangerChat = await call('GET', `/matches/${matchId}/messages`, undefined, bystander);
  check('a non-participant cannot read the thread (404)', strangerChat.status === 404, `got ${strangerChat.status}`);

  const empty = await call('POST', `/matches/${matchId}/messages`, { content: '   ' }, candidate);
  check('an empty message is rejected', empty.status === 400, `got ${empty.status}`);

  const listWithUnread = await call('GET', '/matches', undefined, candidate);
  check('unread count reflects the other party only', listWithUnread.body?.[0]?.unreadCount === 1, `${listWithUnread.body?.[0]?.unreadCount}`);
  check('last message preview is present', !!listWithUnread.body?.[0]?.lastMessage?.content);
  check('post-match, the counterparty is named in full', listWithUnread.body?.[0]?.counterparty?.name === 'Rahul Mehta', listWithUnread.body?.[0]?.counterparty?.name);

  await call('POST', `/matches/${matchId}/messages/read`, {}, candidate);
  const afterRead = await call('GET', '/matches', undefined, candidate);
  check('marking read clears the badge', afterRead.body?.[0]?.unreadCount === 0, `${afterRead.body?.[0]?.unreadCount}`);

  // ---- interview ----------------------------------------------------------
  const day = (n: number, hour: number) => {
    const d = new Date(Date.now() + n * 86_400_000);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const slots = [
    { start: day(2, 10), end: day(2, 11), timezone: 'Asia/Kolkata' },
    { start: day(3, 15), end: day(3, 16), timezone: 'Asia/Kolkata' },
  ];

  const candGetsProposal = nextEvent(candSocket, 'interview:proposed');
  const proposed = await call('POST', `/matches/${matchId}/interview`, { slots }, recruiter);
  check('recruiter proposes slots', proposed.status === 200 && proposed.body?.status === 'proposed', `got ${proposed.status}`);
  check('the candidate sees the proposal live', (await candGetsProposal) !== null);

  const candidateProposing = await call('POST', `/matches/${matchId}/interview`, { slots }, candidate);
  check('a candidate cannot propose slots (404)', candidateProposing.status === 404, `got ${candidateProposing.status}`);

  const pastSlot = await call('POST', `/matches/${matchId}/interview`, { slots: [{ start: day(-3, 10), end: day(-3, 11), timezone: 'Asia/Kolkata' }] }, recruiter);
  check('a slot in the past is rejected', pastSlot.status === 400, `got ${pastSlot.status}`);

  const outOfRange = await call('POST', `/matches/${matchId}/interview/accept`, { slotIndex: 4 }, candidate);
  check('accepting a slot that was not offered is rejected', outOfRange.status === 400, `got ${outOfRange.status}`);

  const recGetsConfirm = nextEvent<{ confirmedSlot: { start: string } }>(recSocket, 'interview:confirmed');
  const accepted = await call('POST', `/matches/${matchId}/interview/accept`, { slotIndex: 1 }, candidate);
  check('candidate confirms a slot', accepted.status === 200 && accepted.body?.status === 'confirmed', `got ${accepted.status}`);
  check('the confirmed slot is the one chosen', accepted.body?.confirmedSlot?.start === slots[1].start);
  check('the recruiter sees the confirmation live', (await recGetsConfirm)?.confirmedSlot?.start === slots[1].start);

  const reAccept = await call('POST', `/matches/${matchId}/interview/accept`, { slotIndex: 0 }, candidate);
  check('a confirmed interview cannot be re-accepted', reAccept.status === 409, `got ${reAccept.status}`);

  // ---- outcome ------------------------------------------------------------
  const candidateOutcome = await call('PATCH', `/matches/${matchId}/outcome`, { outcome: 'hired' }, candidate);
  check('a candidate cannot set the outcome (404)', candidateOutcome.status === 404, `got ${candidateOutcome.status}`);

  const candGetsOutcome = nextEvent<{ status: string }>(candSocket, 'match:outcome');
  const hired = await call('PATCH', `/matches/${matchId}/outcome`, { outcome: 'hired' }, recruiter);
  check('recruiter marks the candidate hired', hired.status === 200 && hired.body?.status === 'archived', `got ${hired.status} ${hired.body?.status}`);
  check('the candidate is told live', (await candGetsOutcome)?.status === 'archived');

  const jobAfter = await call('GET', `/jobs/${jobId}`, undefined, recruiter);
  check('hiring fills the job', jobAfter.body?.status === 'filled', jobAfter.body?.status);

  const closedSend = await call('POST', `/matches/${matchId}/messages`, { content: 'one more thing' }, candidate);
  check('a closed thread stops accepting messages', closedSend.status === 400, `got ${closedSend.status}`);

  const closedRead = await call('GET', `/matches/${matchId}/messages`, undefined, candidate);
  check('but the history stays readable', closedRead.status === 200 && closedRead.body?.items?.length === 2, `got ${closedRead.status}`);

  const twice = await call('PATCH', `/matches/${matchId}/outcome`, { outcome: 'not_selected' }, recruiter);
  check('an outcome cannot be set twice', twice.status === 400, `got ${twice.status}`);

  candSocket.close();
  recSocket.close();

  // ---- cleanup ------------------------------------------------------------
  const all = Object.values(emails);
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query('DELETE FROM swipes WHERE actor_id IN (SELECT id FROM users WHERE email = ANY($1))', [all]);
  await db.query('DELETE FROM matches WHERE job_id = $1', [jobId]);
  await db.query('DELETE FROM jobs WHERE id = $1', [jobId]);
  await db.query('DELETE FROM recruiter_profiles WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))', [all]);
  await db.query("DELETE FROM companies WHERE name = 'Razorpay'");
  const removed = await db.query('DELETE FROM users WHERE email = ANY($1)', [all]);
  await db.end();
  console.log(`\ncleanup: removed ${removed.rowCount} test users`);

  console.log(failures === 0 ? '\nFull loop: PASS' : `\nFull loop: FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nverify-loop crashed:', err.message);
  process.exit(1);
});
