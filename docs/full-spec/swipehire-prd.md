# SwipeHire — Product Requirements Document (PRD)
### Version 1.0 · Dual-Sided Swipe-Based Hiring Marketplace

*Companion files: `swipehire-candidate-flow.mermaid` and `swipehire-recruiter-flow.mermaid` — step-by-step flow diagrams for each user type, referenced in §6.*

---

## 1. Problem Statement

**In plain English:** applying for a job today feels like shouting into a void, and posting one feels like getting buried in noise. SwipeHire's job is to replace both of those with a fast, honest, two-way "yes" — and to make sure real time (a resume review, a phone screen, an interview) only gets spent once *both* sides have actually shown they want to.

**Why traditional job portals are slow, noisy, and inefficient:**

- They optimize for **volume of applications**, not quality of mutual intent. A "successful" job post is one with 500 applicants — even though the recruiter can meaningfully evaluate maybe 20 of them.
- Interest is **one-directional and invisible**. A candidate applies and has no idea whether a human ever opened their resume. A recruiter posts a role and has no idea which of the 500 applicants are still actively interested versus mass-applying to everything with a matching keyword.
- Feedback loops are broken. Silence functions as rejection. Nobody tells the candidate why, and nobody tells the recruiter which of their listings are underperforming and why.
- Outbound sourcing (recruiters cold-messaging candidates on LinkedIn) has a low reply rate precisely because it's one-sided — the recruiter is guessing at interest rather than confirming it.

**Problems specific to candidates:**
- The "application black hole" — no visibility into status, no timeline, no explanation.
- Listings are often stale, vague on compensation, or don't reflect the real day-to-day stack/team.
- Tailoring a resume/cover letter per application is high-effort for uncertain payoff.
- Job searching while employed is risky — most platforms assume you're comfortable being publicly "open to work," which isn't true for a huge share of the workforce.

**Problems specific to recruiters:**
- Signal-to-noise on inbound applications is poor — most applicants didn't read the JD closely, or applied to everything in their field regardless of fit.
- Outbound sourcing is manual, slow, and has a low conversion rate.
- Pipeline management is fragmented across an ATS, LinkedIn, email, and a calendar tool, with no single source of truth for "who's actually still interested."

**The core problem SwipeHire solves:** mutual interest is currently invisible and expensive to discover. SwipeHire makes expressing interest cheap and instant on both sides, and gates everything costly — chat, resumes, contact info, interview time — behind a mutual, double opt-in signal.

---

## 2. Target Users

### 2.1 Job Seekers / Candidates

| | |
|---|---|
| **Goals** | Find relevant roles quickly; avoid wasted effort on dead-end applications; understand comp and expectations upfront; know where they stand at every step |
| **Pain points** | Application black hole, generic/stale listings, resume-tailoring fatigue, spam recruiter outreach, fear of visibility to current employer |
| **Technical comfort** | Broad range — early-career candidates are mobile-native and comfortable with swipe UX by default; mid/senior candidates are comfortable with SaaS tools but time-constrained and impatient with friction or novelty for its own sake |
| **Expectations from SwipeHire** | Fast onboarding, real (not spammy) matches, visible status on every interaction, strong filtering, control over who can see their profile |

### 2.2 Recruiters / Hiring Teams

| | |
|---|---|
| **Goals** | Fill open roles with qualified candidates who are genuinely interested; reduce time spent screening low-relevance applicants |
| **Pain points** | High volume of low-relevance inbound, low-conversion manual outbound sourcing, fragmented tooling (ATS + LinkedIn + email + calendar), pressure to fill roles fast |
| **Technical comfort** | Comfortable with SaaS/ATS tools; not necessarily technical; expects the product to feel like professional software, not a consumer dating app with a new coat of paint |
| **Expectations from SwipeHire** | Candidate quality over quantity, a clear and trustworthy match-quality signal, efficient comparison across candidates, confidence that candidates on the platform are real and are legitimately interested |

### 2.3 Admins / Platform Operators

| | |
|---|---|
| **Goals** | Protect marketplace integrity — keep out fake accounts, scam job postings, and harassment, so the trust loop that makes the whole product work stays intact |
| **Pain points** | Fake recruiter accounts and scam listings are a well-documented, high-volume problem in the Indian job market specifically — this isn't a hypothetical edge case, it's a near-certain day-one risk for any platform structured like this |
| **Technical comfort** | Internal team; uses an admin dashboard; needs efficient moderation queues and marketplace-health analytics, not necessarily deep engineering skill |
| **Expectations from SwipeHire** | Tooling to verify recruiter/company legitimacy, a working report-and-review queue, visibility into marketplace health metrics (match rates, report rates, spam patterns), and the ability to suspend or ban bad actors quickly |

---

## 3. Product Vision

SwipeHire isn't "Tinder for jobs" — it's a **trust-first, mutual-intent layer** that sits between the cold, high-volume job board and the slow, expensive dedicated recruiter. The vision is for SwipeHire to become the fastest, most trustworthy way to find a genuinely willing counterpart in hiring — measured not by number of listings or applicants, but by the ratio of matches that actually turn into real conversations and real hires.

**Differentiation from LinkedIn / Naukri / Indeed:** those platforms optimize for reach — post once, get flooded with applicants of wildly variable relevance. SwipeHire optimizes for a low-cost, mutual "yes" as the gate before either side spends real time.

**Differentiation from a literal dating-app clone:** the swipe is a lightweight interest signal, not the whole decision. Real decisions still require real information — resume, JD, an honest match score, comp transparency — so the product earns trust through transparency and privacy control, not through gamified novelty alone.

**Where this goes long-term:** structured interview-process support, lightweight skills verification, a warm-intro/referral layer, and — critically — becoming the default place *passive* candidates can signal openness privately. A huge share of employed people would happily express quiet interest in the right role but won't flip a public "open to work" flag on LinkedIn for fear of their employer noticing. SwipeHire's privacy-by-default posture is built specifically to serve that segment, which today is almost entirely unserved.

---

## 4. Core Features

| # | Feature | Classification | Notes |
|---|---|---|---|
| 1 | Candidate onboarding | **MVP** | |
| 2 | Recruiter onboarding | **MVP** | |
| 3 | Candidate profile | **MVP** | |
| 4 | Recruiter / company profile | **MVP** | |
| 5 | Resume upload | **MVP** | |
| 6 | Resume parsing (auto-extract skills/experience) | **MVP** (basic) | Rule/keyword-based extraction with candidate review-and-correct step; deeper NLP extraction is a fast-follow |
| 7 | Job creation | **MVP** | |
| 8 | Job discovery (candidate-side feed) | **MVP** | Core loop |
| 9 | Candidate discovery (recruiter-side feed) | **MVP** | Core loop |
| 10 | Swipe deck UI | **MVP** | |
| 11 | Pre-swipe filters | **MVP** | Basic filters only at launch: location, comp range, remote preference, experience level, tech stack |
| 12 | Match percentage | **MVP** (heuristic) | Rule-based score (skill overlap, comp/location fit) at launch; embeddings-based semantic scoring is a Future upgrade once there's real usage data to tune against |
| 13 | Swipe left / right | **MVP** | |
| 14 | Mutual matching | **MVP** | Core mechanic |
| 15 | Fast-Track / Super Swipe | **Future** | Must be designed carefully so it doesn't become pay-to-win — consider making it activity-earned rather than purchased, or it undermines the fairness principle (§10) |
| 16 | Match notifications | **MVP** | Push notifications — the loop doesn't feel alive without this |
| 17 | Chat after matching | **MVP** | Core — the entire point of a match |
| 18 | Interview scheduling | **MVP** (basic) | In-chat "propose a few time slots" flow; full calendar-sync integration is Future |
| 19 | Application / match status tracking | **MVP** | |
| 20 | Recruiter verification | **MVP** (basic) | Work-email-domain check plus manual admin review for anything ambiguous; automated business/KYB-style verification is Future |
| 21 | Candidate / job reporting | **MVP** | Non-negotiable given the fraud risk described in §2.3 — this cannot be a post-launch addition |
| 22 | Admin moderation dashboard | **MVP** (basic) | Manual review queue for reports and flagged listings; automated ML-based spam detection is Future |
| 23 | Privacy controls | **MVP** | Blind-first default visibility, contact-info gating until match — see §10 |

---

## 5. Matching Experience

**When a candidate swipes right on a job:**
The interest is recorded against that specific candidate–job pair. The system checks whether the recruiter behind that listing has already swiped right on this candidate. If yes, a match is created instantly. If not, the candidate's interest is stored and the job simply won't be shown to them again — nothing is sent to the recruiter yet.

**When a recruiter swipes right on a candidate (for a specific listing):**
Same logic in reverse — the interest is recorded against that recruiter–candidate–listing combination, and the system checks for a reciprocal right-swipe from the candidate on that specific job. If found, instant match.

**When a match is created:**
Only when both parties have independently swiped right on each other, for that specific job listing — a candidate matching on one role at a company doesn't imply interest in a different role at the same company. This is deliberately job-specific, not identity-general.

**What becomes available after a match:**
- Any fields hidden under blind-first mode (name, photo, if applicable) unlock.
- The candidate's full resume becomes visible to the recruiter; the recruiter's full company/team detail becomes visible to the candidate.
- In-app chat unlocks between the two parties.
- Interview-scheduling tools become available within the chat thread.

**What happens on a left swipe:**
The pass is recorded so that profile or listing is never shown again to that user — and that's the entire consequence. Nothing is communicated to the other party.

**Why rejected users should not be notified:**
Two reasons, both load-bearing for the product's core mechanic. First, honesty: if a left-swipe were visible to the other party, people would either avoid swiping left on borderline cases out of social discomfort (degrading the *quality* of the signal the whole matching system depends on), or the platform would generate a constant stream of small, explicit rejections at scale — which is precisely the rejection-fatigue candidates already experience with traditional job portals, and exactly what SwipeHire exists to reduce. Second, this protects recruiters too — a visible "we passed" record creates real reputational risk with no corresponding product benefit. Silent rejection isn't a UX shortcut; it's what makes the double opt-in mechanic psychologically safe enough to actually use honestly.

---

## 6. App Flow

Full step-by-step flowcharts for both roles are provided as companion files (`swipehire-candidate-flow.mermaid`, `swipehire-recruiter-flow.mermaid`). Text version below, written to translate directly into engineering tickets.

### 6.1 Candidate Flow

1. Download and open the app.
2. Select role: **"I'm looking for a job."**
3. Sign up (email, phone, or OAuth).
4. Profile setup: name, headline, location, remote preference, experience level.
5. Upload resume.
6. Resume parsed — extracted skills/experience shown for review and correction before saving.
7. Set preferences: desired comp range, job type, target industries, notice period.
8. Enter the discovery feed.
9. Optionally apply filters (remote-only, comp range, tech stack, company size).
10. Swipe through the ranked job-card deck — left to pass, right if interested.
11. On mutual match: push notification — "You matched with [Company] for [Role]."
12. Chat unlocks with the recruiter.
13. Propose/accept an interview time slot within the chat.
14. Outcome recorded in "My Matches": interview happens → hired / not selected / candidate withdraws.

### 6.2 Recruiter Flow

1. Download and open the app.
2. Select role: **"I'm hiring."**
3. Sign up, with company/recruiter verification (work-email-domain check, flagged for manual review if ambiguous).
4. Company profile setup: name, logo, culture blurb, size, industry.
5. Create a job listing: title, tech stack, comp range, description, interview-process outline.
6. Enter the candidate discovery feed, scoped to that specific listing.
7. Optionally apply filters (experience range, location, skills, notice period).
8. Swipe through the ranked candidate-card deck — left to pass, right if interested.
9. On mutual match: push notification — "You matched with [Candidate] for [Role]."
10. Chat unlocks with the candidate.
11. Propose/accept an interview time slot within the chat.
12. Outcome recorded in the pipeline view: interview scheduled → hired / rejected post-interview / withdrawn.

*Product note worth flagging even though it's out of MVP scope: recruiters managing several open listings at once will eventually want a desktop/web view for pipeline management — mobile-only works for V1 but is the most likely candidate for a V1.1 web console.*

---

## 7. MVP Definition

**SwipeHire V1, in one paragraph:** a mobile-only (iOS + Android) app where candidates build a profile and upload a resume, recruiters create job listings tied to a verified company account, both sides browse a filtered, heuristically-ranked swipe deck, and a match — created only on mutual right-swipes for a specific job — unlocks in-app chat and a basic interview-scheduling flow. Trust-and-safety tooling (reporting, verification, admin moderation) and privacy controls (blind-first default) ship on day one, not as a later addition.

**V1 scope boundaries, explicitly:**
- Single geography at launch (India-first), single language (English) at launch.
- One job listing scoped per swipe session on the recruiter side (no bulk/cross-listing candidate browsing yet).
- Match scoring is rule-based/heuristic, not ML-based.
- Interview scheduling is in-chat slot proposal only — no calendar integration.
- Verification is manual-review-backed, not fully automated.
- Mobile apps only — no web client for either role.

Everything marked **MVP** in the §4 feature table, and nothing marked **Future**, is in scope for V1.

---

## 8. Success Metrics

| Metric | Definition | Why it matters |
|---|---|---|
| Signup completion rate | % of app opens that complete account creation | Measures onboarding friction at the very top of the funnel |
| Profile completion rate | % of signed-up users who finish a complete profile | A half-finished profile produces bad match scores for everyone downstream |
| Resume completion rate | % of candidates who successfully upload and confirm a parsed resume | Directly gates candidate-side match quality |
| Swipe-to-match rate | % of right-swipes that result in a mutual match | Core efficiency signal for the ranking/filtering algorithm |
| Match-to-chat rate | % of matches where at least one message is sent | Distinguishes real matches from accidental/low-intent ones |
| Chat-to-interview rate | % of active chats that result in a proposed and accepted interview slot | The metric that actually reflects product value, not just engagement |
| Interview completion rate | % of scheduled interviews that actually happen | Surfaces flakiness/ghosting even after a match |
| Successful hiring rate | % of interviews that convert to an offer/hire | The ultimate outcome metric — everything above is a leading indicator of this |
| Time to first relevant match | Median time from profile completion to first mutual match | Directly measures whether the ranking algorithm is working |
| Candidate retention (D7/D30) | % of candidates still active 7/30 days after signup | |
| Recruiter retention (active listings/week) | % of recruiters with at least one active listing week-over-week | Recruiter churn is usually the leading indicator of a two-sided marketplace failing |

**Guardrail note:** swipe-to-match rate should never be optimized in isolation. A platform that maximizes match volume without a corresponding chat-to-interview rate is reproducing the exact "volume over relevance" failure mode described in §1 — treat chat-to-interview and successful-hiring rate as the metrics that actually matter, and the earlier funnel steps as diagnostic, not as targets in themselves.

---

## 9. What We Are NOT Building in V1

- **Payments or monetization** (subscriptions, boosted listings, paid visibility) — no business model decisions baked into V1 architecture yet.
- **Fast-Track / Super Swipe** — deferred until the fairness implications (§10) can be designed properly.
- **In-app video interviewing** — rely on external tools (Zoom/Meet links shared in chat) for now.
- **Calendar sync / automated invite generation** — in-chat slot proposal only.
- **AI-generated cover letters or one-click mass-apply** — deliberately excluded. This would directly undermine the entire premise of the product: a swipe is supposed to represent real, considered interest, and auto-apply patterns are exactly the volume-over-relevance failure mode SwipeHire exists to fix.
- **Employer review/rating system** (Glassdoor-style) — separate product surface, out of scope.
- **Multi-language support** beyond English at launch.
- **Web client for either role** — mobile-only for V1; a recruiter web console is the most likely first post-MVP addition.
- **ML/embeddings-based semantic matching** — ship the rule-based heuristic first, replace it once there's real usage data to validate against.
- **Automated recruiter/business verification (KYB)** — manual admin review for V1.
- **Public candidate profiles or a social/networking feed** — stay narrowly scoped to the swipe-to-match loop; this is not a LinkedIn competitor.
- **Collaborative/panel hiring workflows** — one recruiter per listing in V1; multi-reviewer pipelines are a Future consideration.

---

## 10. Product Principles

- **Low-friction discovery.** Every step between "open app" and "see the first card" should be minimal. Resume parsing exists to reduce typing, not to add a form.
- **Relevant matching over volume.** Fewer, well-matched cards beat an infinite low-quality stack. This is the single most important principle in the whole document — it's the difference between SwipeHire and a dating-app skin on a job board.
- **Transparency.** Comp ranges visible upfront, match score visible upfront, and a clear status on every match ("awaiting recruiter," "expired," "interview scheduled") — no black-box silence, which is precisely the failure mode described in §1.
- **Privacy by default, not by opt-in.** Blind-first visibility is the default state, not a setting a candidate has to discover. Passive, currently-employed candidates need to be able to explore privately without fear of exposure — this is a real and currently underserved segment.
- **Fairness.** No feature should let one side buy visibility at the expense of match quality for everyone else. Any future "boost" mechanic has to be designed against this constraint from the start, not patched to comply with it later.
- **Anti-spam.** Rate limits on swipes and listings, verification gates for recruiters, and an algorithm that never rewards mass-swipe or mass-apply behavior.
- **Trust and safety first.** Reporting and moderation tooling ship in V1, not as a post-launch addition — given the real, documented prevalence of fake recruiter accounts and job-scam listings in the Indian market specifically, this is a hard requirement for launch, not a hardening pass that happens later.
