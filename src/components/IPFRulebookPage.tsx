import { useMemo, useState } from 'react';
import {
  IPF_CHANGES_URL,
  IPF_RULEBOOK_PDF_URL,
  IPF_RULES_INDEX_URL,
  searchRulebookEntries,
} from '../lib/ipfRulebook';

export function IPFRulebookPage() {
  const [query, setQuery] = useState('');
  const chapters = useMemo(() => searchRulebookEntries(query), [query]);
  const entryCount = chapters.reduce((count, chapter) => count + chapter.entries.length, 0);

  return (
    <main className="rulebook-page">
      <header className="rulebook-heading">
        <p className="eyebrow">OFFICIAL RULES REFERENCE</p>
        <h1>IPF Rulebook</h1>
        <p className="rulebook-edition">Technical Rulebook · English edition · Effective 1 March 2026 · Version 3</p>
        <a className="button button-primary rulebook-pdf-link" href={IPF_RULEBOOK_PDF_URL} target="_blank" rel="noreferrer">
          Open official IPF PDF <span aria-hidden="true">↗</span>
        </a>
      </header>

      <aside className="rulebook-notice" aria-label="Rulebook source notice">
        <strong>Official source governs</strong>
        <p>These original summaries are for quick reference. The official English IPF Technical Rulebook is definitive; follow it if a summary differs or is unclear.</p>
      </aside>

      <section className="rulebook-browser" aria-labelledby="rulebook-browser-title">
        <div className="rulebook-browser-heading">
          <div>
            <p className="eyebrow">BROWSE THE CONTENTS</p>
            <h2 id="rulebook-browser-title">Technical Rulebook sections</h2>
          </div>
          <label className="rulebook-search">
            <span>Search section summaries</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Try “bench press” or “weighing”"
            />
          </label>
        </div>

        <nav className="rulebook-section-nav" aria-label="Rulebook section navigation">
          {chapters.map((chapter) => <a key={chapter.section} href={`#rulebook-section-${chapter.section.replace('.', '-')}`}>{chapter.section}. {chapter.title}</a>)}
        </nav>

        {entryCount === 0 ? (
          <p className="rulebook-empty" role="status">No rule summaries match “{query}”. Try a section name or another term.</p>
        ) : (
          <div className="rulebook-chapters" aria-live="polite">
            {chapters.map((chapter) => (
              <section className="rulebook-chapter" id={`rulebook-section-${chapter.section.replace('.', '-')}`} key={chapter.section}>
                <h3><span>{chapter.section}.</span> {chapter.title}</h3>
                <div className="rulebook-entries">
                  {chapter.entries.map((entry) => (
                    <article className="rulebook-entry" key={entry.section}>
                      <div className="rulebook-entry-heading">
                        <h4><span>{entry.section}</span> {entry.title}</h4>
                        <a href={`${IPF_RULEBOOK_PDF_URL}#page=${entry.page}`} target="_blank" rel="noreferrer" aria-label={`Open official PDF at printed page ${entry.page} for section ${entry.section}`}>
                          PDF p. {entry.page} <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                      <p>{entry.summary}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <footer className="rulebook-sources">
        <h2>Edition and related IPF resources</h2>
        <p>Contents and page references were checked against the English Technical Rulebook, Version 3, effective 1 March 2026. Review the IPF index for newer editions.</p>
        <ul>
          <li><a href={IPF_RULES_INDEX_URL} target="_blank" rel="noreferrer">IPF Technical Rules index</a> — official editions and related rules resources.</li>
          <li><a href={IPF_CHANGES_URL} target="_blank" rel="noreferrer">2026 Changes Explanations</a> — a separate companion document describing amendments; it is not part of the Technical Rulebook.</li>
          <li><a href="https://www.powerlifting.sport/rules/codes/info/approved-list" target="_blank" rel="noreferrer">IPF Approved List</a> — a separate equipment resource.</li>
        </ul>
        <p className="rulebook-appendix-note">Appendix note: the contents list Chapters 1–10 and no appended section. Chapter 10 refers to “Appendix 2, Lifters profile and passport” on printed page 45, but that form is not included in this PDF.</p>
      </footer>
    </main>
  );
}
