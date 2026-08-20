# SwipeHire — Security

What this build actually defends against, what it deliberately does not, and where the line is.

Every item in §1 was verified against the source or by a passing check in `npm run verify:loop` /
`verify:auth`. Nothing here is aspirational.

---

## 1. Implemented

### Authentication

- **Argon2id** password hashing, library defaults so the parameters track OWASP guidance rather
  than being pinned by hand. Never plaintext, not even for seed accounts.
- **Access token 15 minutes, refresh token 30 days**, signed with two different secrets. Signing
  refresh tokens with the access secret would make a stolen access token exchangeable for a
  thirty-day session.
- **Refresh tokens are stored server-side as a SHA-256 hash.** A dump of `refresh_tokens` yields no
  usable sessions, for the same reason `password_hash` exists rather than `password`.
- **Refresh requires two independent checks** — a valid signature *and* a stored row that is neither
  revoked nor expired. The signature alone would make logout a polite request rather than a
  revocation.
- **Logout actually revokes**, and is idempotent: the update is scoped to still-live rows, so a
  repeat logout cannot overwrite the original revocation timestamp.
- **Account enumeration resistance on login**, in both message and timing. "No such user" and "wrong
  password" return the same error, and a missing account still spends one Argon2 hash worth of time
  — a timing difference is as good as an error message to anyone enumerating addresses.
- **Every authenticated request re-reads the user from the database** rather than trusting the
  token's claims. One indexed lookup, in exchange for a deleted account losing access immediately
  and a stale token being unable to assert a role the user no longer holds.
- **Google ID tokens are verified with Google** and `email_verified` is checked before any claim is
  trusted. Accounts are matched on the *verified* address; matching on a client-supplied one would
  be account takeover. The role is never updated from the request — letting a client change it by
  re-authenticating would turn a candidate into a recruiter for free.

### Authorization

- **Server-side ownership check on every resource-ID endpoint.** A guard that passes is
  authentication, never permission — it answers "who is this", never "may they touch this record".
- **`404`, not `403`, for "exists but not yours."** The two cases are indistinguishable from
  outside, so an attacker cannot map what exists by probing.
- **One participation check, used everywhere.** Reading chat history, sending a message, proposing
  an interview and setting an outcome all route through `MatchService.findForParticipant()`, so
  there is exactly one place to be right about it.
- **Role gates are enforced server-side**: only candidates browse jobs and hold resumes, only
  recruiters browse candidates and post listings, only a recruiter sets an outcome, only a candidate
  accepts a slot.

### The match invariant

- **No endpoint anywhere accepts a match from a client.** There is no `POST /matches`. A match
  exists only as a server-derived consequence of two independent, authenticated swipes. Verified by
  test: the loop check asserts a 404.
- **Exactly-once creation** is guaranteed by `UNIQUE (candidate_id, job_id)` with
  `ON CONFLICT DO NOTHING`. Two simultaneous right-swipes race into the database, and the database
  decides.
- **Swipe writes are idempotent** via upsert, so a client retrying after a dropped response cannot
  duplicate.

### Privacy — blind-first

- **Enforced in the payload, not the UI.** Pre-match, a recruiter receives a first name, a last
  initial, a headline, years, city-less location, skill chips and a score. The surname, email, phone
  and resume key **never enter the response**. Hiding fields in the client while the API still
  returns them would undercut the exact story the product tells.
- The full name unlocks post-match. **Contact details never travel**, even then — the full spec
  makes contact sharing an explicit, revocable act rather than an automatic consequence of matching.
- A job card omits `recruiterId`: which account posted a listing is not a candidate's business
  before a match exists.

### Chat

- **No cold-messaging path exists anywhere.** Chat is reachable only through an active match,
  re-checked on every history read and every send — not assumed from a prior socket connection.
- **A closed or archived thread stays readable but accepts no new messages.** The history is part of
  what happened.
- **Read receipts cannot be forged.** `markRead` is scoped to messages *not* sent by the caller, so
  a client cannot mark its own messages read and quietly clear the other side's badge.

### Files

- **Private bucket. Nothing is ever served from a public URL.** Both upload and download go through
  short-lived signed URLs; downloads expire in 300 seconds.
- **The service-role key never leaves the backend.** The client only ever receives a signed URL.
- **Content sniffing on upload — magic bytes, not the declared MIME type.** The upload is a direct
  client-to-storage PUT, so `Content-Type` is exactly as trustworthy as the client. The first bytes
  are the only claim about the file the server can actually check.
- **Object keys are namespaced by user id and checked on parse.** A key that does not start with the
  caller's id returns 404, so one candidate cannot name another's key and have their resume parsed
  into their own profile.
- **Random filenames, not the uploaded one.** The original is attacker-controlled text, and a
  predictable key would invite guessing even against a private bucket.
- **Deletion removes the object, not just the row** — including on every parse-rejection path.
  Resume-only deletion works independently of deleting the account.

### Transport and secrets

- **Input validation on every endpoint**, with `forbidNonWhitelisted` so an unexpected field is a
  400 rather than something silently ignored.
- **CORS is closed, not `*`.** An empty allowlist in production means the deployed backend answers
  no browser origin. Native requests do not enforce CORS, so this costs the app nothing.
- **Sockets are authenticated at handshake** with the same access token; an unauthenticated socket
  is disconnected, not left connected in a degraded state. Each user gets a private room, so no
  broadcast can reach the wrong person.
- **Storage errors are logged, not returned.** They can echo back the key and the bucket, which
  belongs in logs.
- **No secrets in the repo.** `.env` is git-ignored, `.env.example` carries placeholders only, and
  the deployed URL is deliberately kept out of this repository as well — see §4.
- **Migrations never run on boot.** A deploy cannot alter the schema as a side effect of restarting.

## 2. Known deviations

Two things differ from the full specification in ways worth naming rather than burying.

**Tokens are signed HS256, not RS256.** A shared secret is passed to `@nestjs/jwt`, which defaults
to HMAC. For a single service that both signs and verifies, the practical difference is nil. It
becomes a real gap the moment a second service must validate a token without being able to mint one
— that is when it should change, and it is a small change.

**Refresh-token rotation is not implemented.** A refresh returns a fresh access token and the *same*
refresh token, so reuse detection does not exist. A stolen refresh token is usable for its full
thirty days unless someone logs out. This was a deliberate deferral, and it is the first thing to
fix before real users.

## 3. Deliberately not implemented

Each is a recorded decision. None is an oversight, and none is safe to leave undone for real users.

| Not built | Consequence | Why it was acceptable here |
|---|---|---|
| **Rate limiting** | Auth and swipe endpoints can be hammered; credential stuffing is unthrottled | A controlled walkthrough in front of one person has no adversary |
| **Malware scanning** | An uploaded PDF is parsed without being scanned | Only seeded and demo-operator files are uploaded |
| **Row-Level Security** | Application-level ownership checks are the *only* layer | They are genuinely applied on every path, but a single missed check has no net beneath it |
| **Account lockout / CAPTCHA** | Unlimited login attempts | Same reasoning as rate limiting |
| **Recruiter verification** | `companies.verified` defaults to `true` | The Profile screen says this out loud rather than implying a check happened |
| **Reporting, blocking, moderation** | No way to report a user or a listing, and no admin surface | Two participants, both known |
| **DPDP consent flows** | No itemised consent at signup, no deletion pipeline | No real personal data is held |
| **Audit logging** | No record of who accessed what | |
| **Penetration testing** | Never adversarially tested | |

## 4. The hard line

Everything in §3 is fine for a controlled demo in front of one person. **None of it is fine for a
link left standing afterwards.**

Two facts compound each other and are worth stating together:

1. This repository is **public**, and its README publishes the demo password.
2. The backend is deployed and reachable from anywhere.

The only thing keeping that pair from being an open door is that the service URL is **not** in the
repository. It lives in `RENDER-ENV.txt`, which is git-ignored, and it must stay out — including out
of `eas.json`, where a preview build would otherwise bake it into a shipped bundle.

If the client wants to keep exploring after the walkthrough, give them a short-lived EAS preview
whose lifetime you control, and take it down afterwards. Do not leave the demo standing as an
open service.

**Before anything resembling real users:** rotate the Supabase database password and the
service_role key (both have been shared in plaintext during development), then work §3 top to
bottom.
