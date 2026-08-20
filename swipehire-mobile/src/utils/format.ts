import type { WorkMode } from '../types';

/**
 * Display formatters. The demo targets the Indian tech market (Demo PRD §4), so compensation is
 * shown in lakhs/crore rather than thousands — "₹18L–₹28L" is how the salary band actually reads
 * to this audience, and a "₹1,800,000" would immediately look foreign.
 */

function toLakhString(rupees: number): string {
  if (rupees >= 10_000_000) {
    const cr = rupees / 10_000_000;
    return `₹${trimZero(cr)}Cr`;
  }
  const lakh = rupees / 100_000;
  return `₹${trimZero(lakh)}L`;
}

function trimZero(n: number): string {
  // 18.0 → "18", 18.5 → "18.5". A trailing ".0" makes a salary band look computed rather than stated.
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

/** Frontend Spec §5: always a range, and "Not disclosed" rather than hiding the row entirely. */
export function formatSalaryRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Not disclosed';
  if (min != null && max != null) return `${toLakhString(min)}–${toLakhString(max)}`;
  return `${toLakhString((min ?? max) as number)}+`;
}

export function formatWorkMode(mode: WorkMode): string {
  return { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }[mode];
}

export function formatExperience(min: number, max?: number | null): string {
  if (max != null && max !== min) return `${min}–${max} yrs exp`;
  return `${min}+ yrs exp`;
}

export function formatYears(years: number): string {
  return `${years} yr${years === 1 ? '' : 's'} exp`;
}

/** Relative recency, e.g. "2d ago". Long-press for the absolute date is a later polish pass. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Initials for the blind-first avatar (Frontend Spec §6). */
export function initials(firstName: string, lastInitial: string): string {
  return `${firstName.charAt(0)}${lastInitial.charAt(0)}`.toUpperCase();
}

/**
 * Skills for a card's chip row: matched ones first (Frontend Spec §6 — "ranked so matched skills
 * always appear first"), capped at `max` with the remainder returned as an overflow count.
 */
export function rankSkills(
  all: string[],
  matched: string[],
  max = 4,
): { visible: { label: string; matched: boolean }[]; overflow: number } {
  const matchedSet = new Set(matched.map((s) => s.toLowerCase()));
  const ranked = [...all].sort((a, b) => {
    const am = matchedSet.has(a.toLowerCase()) ? 0 : 1;
    const bm = matchedSet.has(b.toLowerCase()) ? 0 : 1;
    return am - bm;
  });

  return {
    visible: ranked.slice(0, max).map((label) => ({ label, matched: matchedSet.has(label.toLowerCase()) })),
    overflow: Math.max(0, ranked.length - max),
  };
}
