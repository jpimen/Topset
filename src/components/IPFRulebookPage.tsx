import { useMemo, useState } from 'react';
import {
  IPF_CHANGES_URL,
  IPF_RULEBOOK_PDF_URL,
  IPF_RULES_INDEX_URL,
  searchRulebookEntries,
} from '../lib/ipfRulebook';

const RECORD_SOURCES = [
  {
    id: 'philippines-classic',
    label: 'National · Classic / Raw',
    title: 'Philippine Classic / Raw National Records',
    description: 'Live spreadsheet from the Philippine national powerlifting association. It includes squat, bench press, deadlift and total records.',
    sourceUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4JeBSzpYmQs_0DbwAl4_GxRuaJH5PtFIJfi0495yLij-KrwDQ8T7rI1Ioiuh2_NMniiAF9oCuvn-Q/pubhtml',
    embedUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4JeBSzpYmQs_0DbwAl4_GxRuaJH5PtFIJfi0495yLij-KrwDQ8T7rI1Ioiuh2_NMniiAF9oCuvn-Q/pubhtml?widget=true&headers=false',
    sourceUpdatedAt: 'The federation index does not show a last-updated date.',
  },
  {
    id: 'philippines-equipped',
    label: 'National · Equipped',
    title: 'Philippine Equipped National Records',
    description: 'Live spreadsheet from the Philippine national powerlifting association. It includes squat, bench press, deadlift and total records.',
    sourceUrl: 'https://docs.google.com/spreadsheets/d/1KSAvpXKVJYWfPfSJCo8X3cgj1GHrYFLEtWSTTftGC6w/edit',
    embedUrl: 'https://docs.google.com/spreadsheets/d/1KSAvpXKVJYWfPfSJCo8X3cgj1GHrYFLEtWSTTftGC6w/preview',
    sourceUpdatedAt: 'The federation index does not show a last-updated date.',
  },
  {
    id: 'asian-classic',
    label: 'Asian · Classic',
    title: 'Asian Classic Powerlifting & Bench Press Records',
    description: 'Official APF records spreadsheet covering squat, bench press, deadlift and total records.',
    sourceUrl: 'https://www.asia-powerlifting.com/fileadmin/asian-powerlifting/data/records/ASIAN__CLASSIC_RECORDS.2024.1.15-.xlsx',
    embedUrl: 'https://docs.google.com/gview?embedded=1&url=https%3A%2F%2Fwww.asia-powerlifting.com%2Ffileadmin%2Fasian-powerlifting%2Fdata%2Frecords%2FASIAN__CLASSIC_RECORDS.2024.1.15-.xlsx',
    sourceUpdatedAt: 'The APF records page lists this sheet as updated 15 January 2024.',
  },
  {
    id: 'asian-equipped',
    label: 'Asian · Equipped',
    title: 'Asian Equipped Powerlifting & Bench Press Records',
    description: 'Official APF records spreadsheet covering squat, bench press, deadlift and total records.',
    sourceUrl: 'https://www.asia-powerlifting.com/fileadmin/asian-powerlifting/data/records/ASIAN__EQUIPPED_RECORDS--2023.11.26.xlsx',
    embedUrl: 'https://docs.google.com/gview?embedded=1&url=https%3A%2F%2Fwww.asia-powerlifting.com%2Ffileadmin%2Fasian-powerlifting%2Fdata%2Frecords%2FASIAN__EQUIPPED_RECORDS--2023.11.26.xlsx',
    sourceUpdatedAt: 'The APF records page lists this sheet as updated 26 November 2023.',
  },
  {
    id: 'world',
    label: 'World',
    title: 'IPF World Records',
    description: 'Live records database linked from the official IPF records page. Use its controls to browse age division, gender, equipment, weight class and lift.',
    sourceUrl: 'https://goodlift.info/records.php?fd=0&ac=0&sx=M&eq=0',
    embedUrl: 'https://goodlift.info/records.php?fd=0&ac=0&sx=M&eq=0',
    sourceUpdatedAt: 'The database reported its latest update as 21 September 2026, 18:16 GMT.',
  },
] as const;

export function IPFRulebookPage() {
  const [query, setQuery] = useState('');
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [activeRecordSourceId, setActiveRecordSourceId] = useState<string>(RECORD_SOURCES[0].id);
  const [recordSourceRefresh, setRecordSourceRefresh] = useState(0);
  const chapters = useMemo(() => searchRulebookEntries(query), [query]);
  const entryCount = chapters.reduce((count, chapter) => count + chapter.entries.length, 0);
  const activeRecordSource = RECORD_SOURCES.find((source) => source.id === activeRecordSourceId) ?? RECORD_SOURCES[0];

  return (
    <main className="rulebook-page">
      <header className="rulebook-heading">
        <p className="eyebrow">OFFICIAL RULES REFERENCE</p>
        <h1>IPF Rulebook</h1>
        <p className="rulebook-edition">Technical Rulebook · English edition · Effective 1 March 2026 · Version 3</p>
        <div className="rulebook-heading-actions">
          <a className="button button-primary rulebook-pdf-link" href={IPF_RULEBOOK_PDF_URL} target="_blank" rel="noreferrer">
            Open official IPF PDF <span aria-hidden="true">↗</span>
          </a>
          <button
            className="button button-secondary rulebook-record-toggle"
            type="button"
            aria-expanded={recordsOpen}
            aria-controls="rulebook-records"
            onClick={() => setRecordsOpen((isOpen) => !isOpen)}
          >
            {recordsOpen ? 'Hide records' : 'Records'}
          </button>
        </div>
      </header>

      <aside className="rulebook-notice" aria-label="Rulebook source notice">
        <strong>Official source governs</strong>
        <p>These original summaries are for quick reference. The official English IPF Technical Rulebook is definitive; follow it if a summary differs or is unclear.</p>
      </aside>

      {recordsOpen && (
        <section className="rulebook-records" id="rulebook-records" aria-labelledby="rulebook-records-title">
          <div className="rulebook-records-heading">
            <div>
              <p className="eyebrow">OFFICIAL FEDERATION SOURCES</p>
              <h2 id="rulebook-records-title">Powerlifting records</h2>
              <p>Records load from the publishing federation. Refresh this view to pick up source changes; update dates below are the dates reported by each publisher.</p>
            </div>
            <button className="button button-secondary" type="button" onClick={() => setRecordSourceRefresh((refresh) => refresh + 1)}>
              Refresh records
            </button>
          </div>

          <nav className="rulebook-record-tabs" aria-label="Record categories">
            {RECORD_SOURCES.map((source) => (
              <button
                key={source.id}
                type="button"
                aria-pressed={activeRecordSource.id === source.id}
                onClick={() => setActiveRecordSourceId(source.id)}
              >
                {source.label}
              </button>
            ))}
          </nav>

          <article className="rulebook-record-source" aria-live="polite">
            <div className="rulebook-record-source-heading">
              <div>
                <h3>{activeRecordSource.title}</h3>
                <p>{activeRecordSource.description}</p>
                <p className="rulebook-record-update">{activeRecordSource.sourceUpdatedAt}</p>
              </div>
              <a href={activeRecordSource.sourceUrl} target="_blank" rel="noreferrer">
                Open source <span aria-hidden="true">↗</span>
              </a>
            </div>
            <iframe
              key={`${activeRecordSource.id}-${recordSourceRefresh}`}
              className="rulebook-record-frame"
              src={`${activeRecordSource.embedUrl}${activeRecordSource.embedUrl.includes('?') ? '&' : '?'}topsetRefresh=${recordSourceRefresh}`}
              title={activeRecordSource.title}
              loading="lazy"
            />
          </article>

          <p className="rulebook-record-disclaimer">
            The national records are published by the Philippine federation, Asian records by the APF, and world records through the database linked by the IPF.
            Some source tables have not been updated recently; this page shows their published update dates and does not imply they were updated today.
            {' '}<a href="https://www.powerlifting.sport/championships/records" target="_blank" rel="noreferrer">IPF records index</a>
            {' '}· <a href="https://www.asia-powerlifting.com/records" target="_blank" rel="noreferrer">APF records index</a>
            {' '}· <a href="https://linktr.ee/powerlifting.ph" target="_blank" rel="noreferrer">Philippine federation records index</a>
          </p>
        </section>
      )}

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
