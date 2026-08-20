# SwipeHire — DEMO Security Baseline
### Scope: Client Showcase Build — minimum honest bar, not the production security model

---

## 0. What This Document Is

`SwipeHire_Security_Access_Document.md` is a pre-launch security model — RLS on every table, tiered recruiter verification, malware scanning, DPDP compliance, a penetration-test gate. None of that is reachable in a demo timeline, and almost none of it is visible to a client watching a five-minute walkthrough anyway.

This document is the **floor, not the ceiling**: the small set of things that are cheap to build, invisible if missing (until they're not), and that you should not skip even under demo time pressure — because skipping them isn't actually faster, it's just deferred debugging, and a couple of these are the difference between "prototype" and "obviously insecure toy" if a technically-minded client pokes at it.

**Anything not listed here is explicitly deferred to the real Security doc — don't build it, and don't feel behind for not building it.**

---

## 1. Keep These (cheap, and load-bearing even for a demo)

- **Password hashing:** Argon2id (or bcrypt if a library is easier to wire up fast — this is the one place a demo-grade substitution is fine, unlike the full spec's Argon2id-only rule). Never store plaintext, ever, even for seed/test accounts.
- **JWT access + refresh tokens**, short-lived access token (15 min is fine, don't need to tune it), refresh token stored server-side. Skip rotation-on-every-refresh and reuse-detection — nice-to-have, not demo-critical.
- **Every endpoint that takes a resource ID checks ownership server-side** before returning data (e.g., `GET /matches/:id` only returns a match the requester is a participant of). This is a five-minute check per endpoint to write and it's the single most common way a "just for demo" app embarrasses itself if someone changes an ID in a request. Keep this everywhere, no exceptions, even in the demo.
- **Blind-first visibility enforced server-side, not just hidden in the UI** — pre-match, the API response itself should not include a candidate's last name/contact info, not just the frontend choosing not to render it. This is cheap (a conditional in the query/serializer) and it's the one privacy feature that's actually part of the product pitch — faking it in the UI only while the API leaks it undermines the exact story you're trying to tell.
- **No client-created matches** — matches are still only ever a derived server computation from two swipes, never an endpoint a client can POST directly. Cheap to keep, and the story ("the trust model is enforced server-side") is worth telling if a client asks a technical question.
- **Resumes/files served only via presigned URLs**, never a public bucket. This is the default behavior of S3/Supabase Storage presigned URLs anyway — don't go out of your way to make a bucket public for convenience.
- **Basic input validation** on every endpoint (NestJS `class-validator` DTOs, same as the full spec) — rejects malformed requests before they hit business logic. Comes almost for free if you're already using NestJS's standard patterns.
- **CORS locked to your Expo dev/preview origins** — don't leave it wide open just because it's "just a demo."
- **No secrets committed to the repo** — use Railway/Render's environment variable panel (§7 of the Demo Architecture doc), `.env` files git-ignored locally. This costs nothing extra to do right from the start.

---

## 2. Explicitly Skipped for the Demo (and why that's fine)

| Full-spec requirement | Why it's safe to skip here |
|---|---|
| Row-Level Security (RLS) policies | Application-layer ownership checks (§1 above) cover the same risk for a demo's traffic pattern; RLS is defense-in-depth for production scale, not a correctness requirement at this size |
| Malware scanning on file upload | You control every file that goes through the demo (your own seed resumes, or the client's own resume in a live walkthrough) — there's no untrusted public upload surface yet |
| Recruiter tiered verification / manual review queue | No real recruiters, no real fraud risk — see Demo PRD §2 |
| Rate limiting infrastructure | No adversarial traffic in a controlled demo; add before any public link is shared beyond the client |
| DPDP consent-flow UI, data retention/deletion pipeline | No real user data is being collected — seed data only, plus the client's own test account if they try it live |
| Real push notification setup (APNs/FCM certs) | In-app updates over the open socket connection cover the demo journey |
| Penetration testing, OWASP ZAP baseline scan | Not proportionate to a five-minute prototype |
| Session management / "active devices" UI | Not part of the demo journey |
| Field-level envelope encryption for contact PII | Table-level DB encryption (on by default with Neon/Supabase) is an acceptable interim state, same as the full spec allows pre-scale |

---

## 3. One Hard Line: Don't Share This Publicly As-Is

Because most of §2 is skipped, **do not put a public link to this build anywhere beyond the specific client demo** (no public app store listing, no unlisted-but-guessable public URL shared widely, no posting the Expo/EAS link somewhere indexable). It's fine, and normal, for a five-minute controlled walkthrough. It is not fine as an accidentally-public product — the gap between those two is exactly the checklist in the real `SwipeHire_Security_Access_Document.md`, which is what to build before that line gets crossed.

If the client wants to poke at it themselves after the meeting (a very good sign, if it happens), a short-lived, single-use EAS preview link you control the lifetime of is fine — an indefinitely-live public link is not, until the real security doc's checklist is done.
