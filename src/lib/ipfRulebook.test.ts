import { describe, expect, it } from 'vitest';
import { IPF_RULEBOOK_CHAPTERS, searchRulebookEntries } from './ipfRulebook';

describe('IPF Rulebook reference data', () => {
  it('covers all ten chapters and the listed subsection families', () => {
    expect(IPF_RULEBOOK_CHAPTERS.map(({ section }) => section)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    const sections = IPF_RULEBOOK_CHAPTERS.flatMap(({ entries }) => entries.map(({ section }) => section));
    expect(sections).toContain('2.10');
    expect(sections).toContain('3.14');
    expect(sections).toContain('4.2.2');
    expect(sections).toContain('6.3');
    expect(sections).toContain('8.2');
    expect(sections).toContain('9.1');
    expect(sections).not.toContain('Appendix');
    expect(new Set(sections).size).toBe(sections.length);
  });

  it('searches section numbers, titles and summaries and omits non-matching chapters', () => {
    expect(searchRulebookEntries('deadlift').flatMap(({ entries }) => entries.map(({ section }) => section)))
      .toEqual(['3.5', '4', '4.3', '4.3.1']);
    expect(searchRulebookEntries('6.3')[0]?.entries[0]?.title).toContain('Miscellaneous Rules');
    expect(searchRulebookEntries('not in the rulebook')).toEqual([]);
    expect(searchRulebookEntries('   ')).toEqual(IPF_RULEBOOK_CHAPTERS);
  });

  it('provides a PDF page locator for every summary', () => {
    expect(IPF_RULEBOOK_CHAPTERS.flatMap(({ entries }) => entries).every(({ page }) => page >= 4 && page <= 44)).toBe(true);
  });
});
