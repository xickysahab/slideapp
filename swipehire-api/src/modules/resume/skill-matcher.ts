import { SKILLS_TAXONOMY, type SkillEntry } from './data/skills-taxonomy';

/**
 * Finds known skills in resume text.
 *
 * Word-boundary matching, not substring: a plain `includes` would find "Java" inside "JavaScript"
 * and credit every React developer with Java. Since several skill names contain regex
 * metacharacters — C++, C#, Node.js, CI/CD — each term is escaped and given boundaries that behave
 * sensibly around punctuation, which `\b` alone does not (`\bC++\b` never matches, because there is
 * no word boundary after `+`).
 */

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A term matches when nothing word-like abuts it on either side.
 *
 * Lookarounds rather than consumed characters, because a consuming boundary can't tell a sentence's
 * full stop from the dot inside a name. The two sides are deliberately not symmetric:
 *
 * - **Leading** also excludes `.`, so the "JS" in "Node.js" doesn't get read as JavaScript and the
 *   "SQL" in "PostgreSQL" doesn't get read as SQL.
 * - **Trailing** allows `.`, because "Kubernetes." and "C++." are how skills actually appear at the
 *   end of a sentence. Excluding it there silently lost any skill that ended a line — the common
 *   case, traded away to guard against a rare one.
 *
 * `+` and `#` are excluded on both sides so "C" can never match inside "C++" or "C#".
 */
function buildPattern(term: string): RegExp {
  return new RegExp(
    `(?<![A-Za-z0-9+#.])${escapeRegex(term)}(?![A-Za-z0-9+#])`,
    'i',
  );
}

interface CompiledSkill {
  canonical: string;
  patterns: RegExp[];
}

const COMPILED: CompiledSkill[] = SKILLS_TAXONOMY.map((entry: SkillEntry) => ({
  canonical: entry.canonical,
  patterns: [entry.canonical, ...(entry.aliases ?? [])].map(buildPattern),
}));

export interface SkillMatchResult {
  /** Canonical skill names found, in taxonomy order so output is stable across runs. */
  skills: string[];
  /** Characters of text the extractor produced — useful for spotting an image-only PDF. */
  textLength: number;
}

export function extractSkills(text: string): SkillMatchResult {
  // Resume PDFs routinely come out with hard line breaks mid-phrase; collapsing whitespace lets
  // multi-word terms like "React Native" and "System Design" survive the wrap.
  const normalised = text.replace(/\s+/g, ' ');

  const skills = COMPILED.filter((skill) => skill.patterns.some((p) => p.test(normalised))).map(
    (skill) => skill.canonical,
  );

  return { skills, textLength: normalised.trim().length };
}
