/**
 * Match scoring — Demo Architecture §5, embeddings-skipped variant.
 *
 * The doc gives three factors with the semantic-similarity one conditional on an embeddings API
 * being wired up. It isn't for this build, so §5's own instruction applies: "just reweight to
 * skills 80% / experience 20% and drop the semantic-similarity row."
 *
 * A pure function on purpose. Scoring is the one piece of logic a client will ask pointed questions
 * about ("why is this 74?"), so it has to be inspectable, deterministic, and testable without a
 * database.
 *
 * The score is real. §5 is explicit that either variant is honest to show a client, but that you
 * must never fake a number that doesn't come from real computation.
 */

export const SKILLS_WEIGHT = 0.8;
export const EXPERIENCE_WEIGHT = 0.2;

/**
 * How many years below the requirement takes the experience factor to zero.
 *
 * Three is a judgement call the docs leave open — they say only "tapering below it". A cliff at the
 * requirement would make a 4-year candidate for a 5-year role score the same as a fresher, which is
 * plainly wrong and would look wrong on the deck.
 */
export const EXPERIENCE_TAPER_YEARS = 3;

export interface MatchInput {
  candidateSkills: string[];
  jobTechStack: string[];
  candidateYears: number | null;
  jobMinYears: number | null;
}

export interface MatchBreakdown {
  /** 0–100, rounded. What gets stored and shown in the Match Seal. */
  score: number;
  skills: {
    /** 0–1. Share of the job's required stack the candidate has. */
    factor: number;
    matched: string[];
    missing: string[];
  };
  experience: {
    /** 0–1. */
    factor: number;
    candidateYears: number;
    requiredYears: number;
  };
}

const normalise = (skill: string): string => skill.trim().toLowerCase();

/**
 * Share of the job's requirements the candidate covers.
 *
 * The denominator is the job's stack, not the union: a candidate who knows all five required skills
 * plus twenty others has met the requirement completely, and Jaccard would punish them for breadth.
 * The question the deck is answering is "can this person do this job", not "how similar are these
 * two lists".
 */
function skillsFactor(candidateSkills: string[], jobTechStack: string[]) {
  const required = [...new Set(jobTechStack.map(normalise))].filter(Boolean);
  if (required.length === 0) {
    // No stated requirement means nothing to fail; the weight moves to experience by default.
    return { factor: 1, matched: [], missing: [] };
  }

  const held = new Set(candidateSkills.map(normalise).filter(Boolean));

  // Original casing is preserved for display — the recruiter typed it, and echoing it back
  // lower-cased would look like a bug on the card.
  const matched = jobTechStack.filter((s) => held.has(normalise(s)));
  const missing = jobTechStack.filter((s) => !held.has(normalise(s)));

  return { factor: matched.length / required.length, matched, missing };
}

/** Full marks at or above the requirement, tapering linearly to zero over the window below it. */
function experienceFactor(candidateYears: number | null, jobMinYears: number | null) {
  const required = jobMinYears ?? 0;
  // A candidate who never filled in the field is treated as zero rather than skipped. Nothing here
  // can invent experience, and onboarding asks for it as a plain form field (Architecture §6).
  const actual = candidateYears ?? 0;

  if (required <= 0 || actual >= required) {
    return { factor: 1, candidateYears: actual, requiredYears: required };
  }

  const shortfall = required - actual;
  const factor = Math.max(0, 1 - shortfall / EXPERIENCE_TAPER_YEARS);

  return { factor, candidateYears: actual, requiredYears: required };
}

export function computeMatch(input: MatchInput): MatchBreakdown {
  const skills = skillsFactor(input.candidateSkills, input.jobTechStack);
  const experience = experienceFactor(input.candidateYears, input.jobMinYears);

  const raw = skills.factor * SKILLS_WEIGHT + experience.factor * EXPERIENCE_WEIGHT;

  return {
    score: Math.round(raw * 100),
    skills,
    experience,
  };
}
