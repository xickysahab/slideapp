# SwipeHire — Architecture

Describes the system as built. Every claim here was checked against the source, not carried over
from a planning document.

---

## 1. Stack

| Layer | Choice | Note |
|---|---|---|
| Mobile | Expo SDK 57, React Native 0.86 (New Architecture), TypeScript | Expo Go for the demo; `eas.json` carries a preview profile |
| Animation | Reanimated + Gesture Handler 2 | Swipe gesture runs entirely on the UI thread |
| Navigation | React Navigation (native stack + bottom tabs) | Not Expo Router |
| Client state | Zustand (`store/auth.ts`) | Session and tokens only |
| Server state | TanStack Query | Cursor-paginated lists |
| Backend | NestJS 11, TypeScript, modular monolith | Not microservices |
| Database | PostgreSQL (Supabase), `pgvector` + `pgcrypto` + `citext` | 11 tables |
| ORM / migrations | TypeORM, hand-written SQL migrations | `synchronize: false`, permanently |
| Realtime | Socket.io, single instance, `/realtime` namespace | No Redis adapter — nothing to fan out across |
| Object storage | Supabase Storage, private bucket | Signed URLs both directions |
| Resume parsing | `pdf-parse` v2 in-process | No separate Python service |
| Auth | Custom JWT + Argon2id, Passport strategy | See §6 |
| Host | Render free tier (backend), Expo (mobile) | See `../DEPLOY.md` |

**No Redis, no SQS, no AWS provisioning, no separate NLP service.** Those are production concerns
a demo never exercises. Module boundaries and table names are kept aligned with the production
spec so re-adding that infrastructure later is additive rather than a rewrite.

## 2. Shape

```
   iOS / Android (Expo)
        │
        ├── HTTPS ──────────► NestJS API ──► PostgreSQL (Supabase)
        │                        │
        ├── WSS /realtime ───────┤
        │                        └────────► Supabase Storage (private)
        │
        └── PUT (signed URL) ─────────────► Supabase Storage
```

The resume upload is the one path that bypasses the API: the client PUTs the PDF straight to
storage using a short-lived signed URL, then asks the server to parse it by key. The file never
transits the API process on the way in.

### Modules

`AuthModule` · `ProfileModule` · `JobModule` (jobs + discovery) · `SwipeMatchModule` (swipes +
matches) · `ChatModule` · `InterviewModule` · `ResumeModule`, plus shared `RealtimeModule`,
`StorageModule` and `HealthModule`.

Table ownership is fixed: `SwipeMatchModule` owns `swipes` and `matches`, `ChatModule` owns
`messages`, and so on. Modules call each other's services rather than querying each other's tables
— `ChatService` routes every participation check through `MatchService.findForParticipant()`. That
boundary is what would make a future service extraction mechanical instead of a rewrite.

`RealtimeGateway` lives in `shared/` rather than inside `ChatModule` deliberately: two modules need
to push to a user (`SwipeMatchModule` fires `match:created`, `ChatModule` fires `message:new`), and
chat owning the server would force a dependency cycle, since chat already depends on swipe-match
for match validation.

## 3. Database

Eleven tables. `gen_random_uuid()` primary keys everywhere except `swipes` and `messages`, which use
`BIGSERIAL` — a deliberate, narrow exception for the two highest-write-frequency tables.

| Table | Key | Purpose |
|---|---|---|
| `users` | UUID | Email (`CITEXT`, unique), Argon2id hash, role |
| `profiles` | `user_id` | Name, avatar, city — both roles |
| `candidate_profiles` | `user_id` | Headline, title, years, `skills TEXT[]`, resume key, `resume_embedding VECTOR(768)`, salary range, work mode, notice |
| `companies` | UUID | Name, logo, industry, `verified` (defaults `true`) |
| `recruiter_profiles` | `user_id` | Joins a recruiter to one company |
| `jobs` | UUID | Title, description, `tech_stack TEXT[]`, comp range, city, work mode, min years, `embedding VECTOR(768)`, `status` |
| `swipes` | BIGSERIAL | Polymorphic target, direction, `job_id` |
| `matches` | UUID | Candidate × recruiter × job, score, status, `outcome_note` |
| `messages` | BIGSERIAL | `match_id`, sender, content, `read_at` |
| `interviews` | UUID | `proposed_slots JSONB`, `confirmed_slot`, status |
| `refresh_tokens` | UUID | SHA-256 hash, expiry, revocation |

**There is no `conversations` table.** A match *is* the thread — `messages.match_id` references
`matches.id` directly.

**`swipes.target_id` is intentionally polymorphic** with no foreign key. Integrity is enforced in
the application layer. This is a conscious write-path trade-off, not an oversight.

### The two constraints that carry correctness

```sql
-- exactly-once match creation
UNIQUE (candidate_id, job_id)   -- on matches

-- swipe dedup, split because NULLs are never equal in Postgres
CREATE UNIQUE INDEX uq_swipe_no_job  ON swipes (actor_id, target_type, target_id)
  WHERE job_id IS NULL;                                    -- candidate → job
CREATE UNIQUE INDEX uq_swipe_per_job ON swipes (actor_id, target_type, target_id, job_id)
  WHERE job_id IS NOT NULL;                                -- recruiter → candidate, per listing
```

The split matters. A single unique constraint including `job_id` would silently stop protecting
every candidate→job swipe, because those rows have `job_id IS NULL` and Postgres never treats two
NULLs as equal — a constraint covering half the rows is worse than none, because it looks like it
is working.

### Deviations from the planning schema, and why

Four migrations sit on top of the transcribed spec schema, each kept separate so the deviation stays
visible in history:

1. **`citext` extension** — the spec declares `users.email CITEXT` but never creates the extension.
   Running it verbatim fails. The alternative, downgrading to `TEXT`, would lose the
   case-insensitive uniqueness that stops `A@x.com` and `a@x.com` registering twice.
2. **`matches.outcome_note`** — the outcome tail needed one nullable column for optional recruiter
   feedback.
3. **`refresh_tokens`** — the spec requires server-side refresh storage but defines no table for it.
   A column on `users` would have been smaller but caps a user at one live session, and the same
   account is often open on a simulator and a phone at once during a demo.
4. **`recruiter_profiles` and `swipes.job_id`** — without the first, a recruiter who has set up a
   company but not yet posted a job is unreachable from their own account. Without the second, a
   recruiter who passes on a candidate for one listing loses them from *every* listing's deck, and
   match detection cannot tell which job a right-swipe was for — while `matches` is keyed per job.
   The two tables would disagree about what a swipe means.

## 4. Swipe → match

Synchronous, Postgres-backed. The production design buffers swipes in Redis and checks mutuality
with a set membership test; the demo does the same logic against the database directly, and the
constraint underneath is what actually guarantees correctness in both.

1. **Resolve context.** A candidate swipes on a job, and the job identifies everything else. A
   recruiter swipes on a candidate *for one of their listings*, so the swipe carries an explicit
   `job_id`, and ownership of that listing is checked — 404, not 403, if it is not theirs.
2. **Upsert the swipe.** Raw SQL, because the uniqueness lives in partial indexes and `ON CONFLICT`
   must name the same predicate to use one. The upsert is also what makes the write idempotent, so
   a client retrying after a dropped response cannot duplicate.
3. **Left swipes stop here.** They never touch the match check and never emit an event.
4. **Right swipes check reciprocity** — did the other party already swipe right on this exact
   pairing?
5. **Create the match, exactly once:**

   ```sql
   INSERT INTO matches (candidate_id, recruiter_id, job_id, match_score)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (candidate_id, job_id) DO NOTHING
   RETURNING id
   ```

   If both sides swipe right in the same instant and two requests race, the database decides and
   the loser reads back the winner's row. Synchronous and inside a transaction, because a match is
   too significant an event to risk to a batch flush.
6. **Emit `match:created` after the transaction commits.** The notification is a consequence of the
   match existing, not a participant in creating it — a socket failure must not roll back a match
   both parties have earned.

## 5. Match scoring

A pure function, `shared/matching/match-score.ts`, with unit tests. No database, no I/O — scoring is
the one piece a client will ask pointed questions about ("why is this 74?"), so it has to be
inspectable and deterministic.

```
score = round(100 × (0.8 × skillsFactor + 0.2 × experienceFactor))
```

**Skills factor** = (job's required skills the candidate holds) ÷ (job's required skills).
The denominator is the job's stack, not the union of both. A candidate who knows all five required
skills plus twenty others has met the requirement completely; Jaccard similarity would punish them
for breadth. The question is "can this person do this job", not "how similar are these two lists".
Matching is case-insensitive, but the recruiter's original casing is preserved for display.

**Experience factor** = full marks at or above the requirement, then tapering linearly to zero over
three years below it. A cliff at the requirement would score a 4-year candidate for a 5-year role
the same as a fresher, which is plainly wrong and would look wrong on the deck. The three-year
window is a judgement call the planning docs left open.

A job with no stated stack scores 1.0 on skills — nothing to fail — and the weight effectively
moves to experience.

## 6. Auth

- **Argon2id** for passwords, library defaults, which track current OWASP guidance rather than
  hand-pinned numbers that would stop tracking it.
- **Access token: 15 minutes. Refresh token: 30 days**, stored server-side as a SHA-256 hash. A dump
  of `refresh_tokens` yields no usable sessions.
- **SHA-256 and not Argon2 for the refresh token**, deliberately: it is a 300-bit random value, not
  a human-chosen password. There is no guessable keyspace to slow an attacker through, and refresh
  runs on every app foreground, so a slow hash would be paid on every request for no gain.
- **Refresh requires two independent checks**: the JWT signature must verify *and* the hash must
  match a row that is neither revoked nor expired. The signature alone is not enough — the stored
  row is what makes logout able to actually end a session.
- **Timing-equalised login.** A missing account still spends one Argon2 hash worth of time, so
  response time does not reveal whether an address is registered. Signup deliberately does not make
  the same guarantee, since account creation cannot hide the outcome.

> **Deviation worth naming: tokens are signed HS256, not RS256.** The full spec calls for RS256
> asymmetric signing. This build passes a shared secret to `@nestjs/jwt`, which defaults to HMAC.
> For a single-service demo the practical difference is nil — there is no second service that needs
> to verify without being able to sign. It becomes a real gap the moment anything else has to
> validate a token, and that is when it should change.

**Refresh-token rotation is not implemented.** A refresh returns a fresh access token and the *same*
refresh token. Reuse detection therefore does not exist.

## 7. Realtime

Socket.io on the `/realtime` namespace, kept off the default namespace so a stray connection to `/`
does not look like a live client.

Every connection is authenticated at handshake with the same access token the REST API uses, taken
from `handshake.auth.token` (React Native cannot set arbitrary headers on the websocket transport)
with an `Authorization` header as a fallback. An unauthenticated socket is **disconnected**, not
left connected in a degraded state.

Each user joins a private room named `user:<id>`, so emitting reaches every device that user has
open without the sender knowing socket ids and without any broadcast that could reach the wrong
person.

| Event | Fired when |
|---|---|
| `match:created` | A mutual right-swipe creates a match |
| `match:outcome` | A recruiter marks Hired / Not Selected |
| `message:new` | A message is sent (both parties, including the sender's other devices) |
| `message:read` | The counterparty marks the thread read |
| `interview:proposed` | A recruiter proposes slots |
| `interview:confirmed` | A candidate accepts one |

**Chat writes go over REST, not the socket.** The full spec's gateway accepts sends over the
socket; this build does not. Two write paths means the match check, the closed-thread rule and the
validation all have to be right twice — and "re-validated on every single send" is the thing not to
get wrong. One path, checked once, delivered instantly is the same experience with half the surface.

## 8. Resume pipeline

1. `POST /resume/upload-url` → server mints a signed URL for a key namespaced `<userId>/<uuid>.pdf`.
   Random filename, not the uploaded one: the original is attacker-controlled text, and a
   predictable key would invite guessing.
2. Client `PUT`s the PDF straight to storage.
3. `POST /resume/parse` with the key. The server:
   - checks the key starts with the caller's user id — 404 otherwise, so one candidate cannot name
     another's key and have their resume parsed into their own profile;
   - downloads the object and **sniffs the first bytes for `%PDF-`**. Not the extension, not the
     declared MIME type — the upload is a direct client-to-storage PUT, so the `Content-Type` header
     is exactly as trustworthy as the client;
   - extracts text with `pdf-parse` v2 (a class holding a live handle, destroyed in a `finally` —
     leaking one per upload would slowly eat the process);
   - matches against a ~90-entry skill taxonomy and writes the result onto the profile;
   - deletes the stored object on every rejection path, so a rejected file does not pay rent.
4. Zero extracted text returns a distinct 422 naming the scanned-PDF case, rather than "no skills
   found" — that would send the user hunting for the wrong problem. OCR is out of scope.
5. Replacing a resume deletes the previous object.

Runs synchronously. At one upload at a time, a few seconds inside the request is fine, and the
client shows a parsing screen for exactly this.

## 9. Discovery

Both decks load the eligible set, score it in the application, and sort. Scoring in SQL would make
the function un-unit-testable; at the 15–20 seeded rows this build targets, in-memory costs nothing.
**This is the first thing that would have to change under real load** — the note lives in the source
for that reason.

Already-swiped targets are excluded in **both** directions, because a left swipe is permanent.
Recruiter exclusions are scoped per listing.

Pagination is an opaque base64url offset cursor, 20 per page. Ranking is computed rather than
stored, so there is no column to seek on; the cursor stays opaque so swapping it for a real keyset
cursor later does not change the contract. A malformed cursor restarts the deck rather than
500-ing mid-demo.

Candidates missing skills or a name are filtered out — they have not finished onboarding, and an
empty card reads as a bug rather than as an honest blank.

## 10. Deployment

Backend on Render's free tier, Singapore, from `render.yaml` at the repo root. Database and storage
on Supabase, `ap-south-1`.

Two operational facts that are not obvious and both cost a failed deploy to learn:

- **`DATABASE_URL` must be Supabase's session pooler, not the direct connection.** The direct host
  `db.<ref>.supabase.co` has *no A record at all* — it resolves IPv6-only, and the host's outbound
  is IPv4. There is no code fix; it is purely which string is in the dashboard. It works from a
  laptop with IPv6, which is why it stays invisible until deployed.
- **The free tier spins down after 15 minutes idle**, and the next request pays a 40–60 second cold
  start. Warm it before a demo, not during one.

Migrations never run on boot — a deploy should not be able to alter the schema as a side effect of
restarting. They are run explicitly with `npm run migration:run`.

Full deploy procedure: `../DEPLOY.md`.

## 11. Going from demo to real

In rough dependency order:

1. Redis in front of the swipe path — buffer writes, `SISMEMBER` for the mutual check, a short lock
   around match creation. The unique constraint stays as the correctness floor underneath it.
2. A queue for everything downstream of a match: push notifications, and resume parsing off the
   request path.
3. RS256, and refresh-token rotation with reuse detection.
4. Row-Level Security on every user-scoped table, as a second layer under the existing
   application-level ownership checks — not as a replacement for them.
5. Rate limiting on auth and swipe endpoints; malware scanning in the upload pipeline.
6. Embeddings: populate the two vector columns, add the semantic factor back as a third weighted
   term. The columns and HNSW indexes already exist.
7. Move scoring out of the application once the eligible set stops fitting in memory.
8. Socket.io Redis adapter, then horizontal scale.
