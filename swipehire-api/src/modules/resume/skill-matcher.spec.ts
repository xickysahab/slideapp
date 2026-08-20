import { extractSkills } from './skill-matcher';

describe('extractSkills', () => {
  it('finds plain skill names', () => {
    const { skills } = extractSkills('Worked with Python, Docker and Kubernetes.');
    expect(skills).toEqual(expect.arrayContaining(['Python', 'Docker', 'Kubernetes']));
  });

  it('does not find Java inside JavaScript', () => {
    // The failure a plain substring match makes, and the reason for word boundaries.
    const { skills } = extractSkills('Five years of JavaScript and TypeScript.');
    expect(skills).toContain('JavaScript');
    expect(skills).not.toContain('Java');
  });

  it('still finds Java when it stands alone', () => {
    const { skills } = extractSkills('Backend in Java and Spring Boot.');
    expect(skills).toContain('Java');
    expect(skills).toContain('Spring Boot');
  });

  it('matches names containing regex metacharacters', () => {
    // `\bC++\b` never matches anything — there is no word boundary after '+'.
    const { skills } = extractSkills('Systems work in C++ and C#, plus CI/CD pipelines.');
    expect(skills).toEqual(expect.arrayContaining(['C++', 'C#', 'CI/CD']));
  });

  it('does not credit C++ as C#, or either as the other', () => {
    const { skills } = extractSkills('Wrote a renderer in C++.');
    expect(skills).toContain('C++');
    expect(skills).not.toContain('C#');
  });

  it('folds aliases onto one canonical name', () => {
    const { skills } = extractSkills('NodeJS on the server, ReactJS on the client, PostgreSQL below.');
    expect(skills).toEqual(expect.arrayContaining(['Node.js', 'React', 'Postgres']));
    // No near-duplicates: the chip row should read as three skills, not six.
    expect(skills.filter((s) => s === 'Node.js')).toHaveLength(1);
    expect(skills).not.toContain('NodeJS');
  });

  it('survives the line wrapping that PDF extraction produces', () => {
    const { skills } = extractSkills('Skills: React\nNative, System\n   Design');
    expect(skills).toEqual(expect.arrayContaining(['React Native', 'System Design']));
  });

  it('is case insensitive', () => {
    const { skills } = extractSkills('kubernetes, TERRAFORM, GraphQl');
    expect(skills).toEqual(expect.arrayContaining(['Kubernetes', 'Terraform', 'GraphQL']));
  });

  it('finds nothing in prose that merely contains short words', () => {
    // The reason bare "Go", "C" and "R" are not in the taxonomy: this sentence would otherwise
    // credit the candidate with three languages.
    const { skills } = extractSkills('I go to the R&D team and c the results.');
    expect(skills).toHaveLength(0);
  });

  it('reports text length so an image-only PDF is distinguishable from an unskilled one', () => {
    expect(extractSkills('   ').textLength).toBe(0);
    expect(extractSkills('Python').textLength).toBeGreaterThan(0);
  });

  it('returns skills in a stable order', () => {
    const a = extractSkills('Docker Python AWS').skills;
    const b = extractSkills('AWS Docker Python').skills;
    expect(a).toEqual(b);
  });
});
