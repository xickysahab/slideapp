import { computeMatch } from './match-score';

describe('computeMatch', () => {
  const base = {
    candidateSkills: ['Node.js', 'Postgres', 'AWS'],
    jobTechStack: ['Node.js', 'Postgres', 'AWS'],
    candidateYears: 5,
    jobMinYears: 3,
  };

  it('scores a perfect fit at 100', () => {
    expect(computeMatch(base).score).toBe(100);
  });

  it('scores a total mismatch at 0 when experience also falls away', () => {
    const { score } = computeMatch({
      candidateSkills: ['Figma'],
      jobTechStack: ['Rust'],
      candidateYears: 0,
      jobMinYears: 10,
    });
    expect(score).toBe(0);
  });

  it('weights skills at 80% and experience at 20%', () => {
    // Half the stack, full experience -> 0.5*80 + 1*20 = 60.
    const { score } = computeMatch({
      ...base,
      candidateSkills: ['Node.js', 'Postgres'],
      jobTechStack: ['Node.js', 'Postgres', 'AWS', 'Kafka'],
    });
    expect(score).toBe(60);
  });

  it('does not punish a candidate for skills beyond the requirement', () => {
    // Breadth is not a defect. Jaccard would drag this well below 100.
    const { score } = computeMatch({
      ...base,
      candidateSkills: [...base.candidateSkills, 'Rust', 'Figma', 'Kafka', 'Spark'],
    });
    expect(score).toBe(100);
  });

  it('matches skills case-insensitively', () => {
    // The recruiter types the stack by hand; the candidate's list comes from the parser.
    const { score } = computeMatch({
      ...base,
      candidateSkills: ['node.js', 'POSTGRES', 'aws'],
    });
    expect(score).toBe(100);
  });

  it('tapers experience instead of cliff-edging it', () => {
    const oneShort = computeMatch({ ...base, candidateYears: 2, jobMinYears: 3 });
    const twoShort = computeMatch({ ...base, candidateYears: 1, jobMinYears: 3 });
    const fresher = computeMatch({ ...base, candidateYears: 0, jobMinYears: 3 });

    // A four-year candidate for a five-year role must not score like a fresher.
    expect(oneShort.score).toBeGreaterThan(twoShort.score);
    expect(twoShort.score).toBeGreaterThan(fresher.score);
    expect(fresher.experience.factor).toBe(0);
  });

  it('gives full experience credit at or above the requirement', () => {
    expect(computeMatch({ ...base, candidateYears: 3, jobMinYears: 3 }).experience.factor).toBe(1);
    expect(computeMatch({ ...base, candidateYears: 20, jobMinYears: 3 }).experience.factor).toBe(1);
  });

  it('treats an unstated requirement as no requirement', () => {
    expect(computeMatch({ ...base, candidateYears: 0, jobMinYears: null }).experience.factor).toBe(1);
    expect(computeMatch({ ...base, jobTechStack: [] }).skills.factor).toBe(1);
  });

  it('treats unstated candidate experience as zero rather than as a pass', () => {
    const { experience } = computeMatch({ ...base, candidateYears: null, jobMinYears: 5 });
    expect(experience.candidateYears).toBe(0);
    expect(experience.factor).toBe(0);
  });

  it('reports which skills matched and which are missing, in the recruiter’s own casing', () => {
    const { skills } = computeMatch({
      candidateSkills: ['node.js'],
      jobTechStack: ['Node.js', 'Kafka'],
      candidateYears: 5,
      jobMinYears: 1,
    });
    expect(skills.matched).toEqual(['Node.js']);
    expect(skills.missing).toEqual(['Kafka']);
  });

  it('produces a spread of scores across different candidates, not a clump', () => {
    // Demo PRD §4: a deck where everything reads 90%+ looks fabricated.
    const job = { jobTechStack: ['Node.js', 'Postgres', 'AWS', 'Kafka'], jobMinYears: 4 };
    const scores = [
      computeMatch({ ...job, candidateSkills: ['Node.js', 'Postgres', 'AWS', 'Kafka'], candidateYears: 6 }).score,
      computeMatch({ ...job, candidateSkills: ['Node.js', 'Postgres'], candidateYears: 3 }).score,
      computeMatch({ ...job, candidateSkills: ['Figma'], candidateYears: 1 }).score,
    ];
    expect(new Set(scores).size).toBe(3);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
  });
});
