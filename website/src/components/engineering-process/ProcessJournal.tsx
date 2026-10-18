import { JOURNAL, JournalEntry } from '../../data/project-process';
import { CodeView } from '../verilog-lab/CodeView';
import './journal.css';

function Entry({ entry, n }: { entry: JournalEntry; n: number }) {
  const id = `log-${entry.id}`;
  if (entry.status === 'pending') {
    return (
      <article className="log pending" id={id} aria-labelledby={`${id}-h`}>
        <header className="log-head">
          <span className="log-n">LOG {String(n).padStart(2, '0')}</span>
          <h3 id={`${id}-h`}>{entry.phase}</h3>
          <span className="log-date">not yet written</span>
        </header>
        <p className="placeholder">
          <b>To document:</b> {entry.prompt}
        </p>
      </article>
    );
  }
  return (
    <article className="log" id={id} aria-labelledby={`${id}-h`}>
      <header className="log-head">
        <span className="log-n">LOG {String(n).padStart(2, '0')}</span>
        <h3 id={`${id}-h`}>
          {entry.phase}
          {entry.title && <span className="log-title"> — {entry.title}</span>}
        </h3>
        {entry.date && <time className="log-date">{entry.date}</time>}
      </header>
      {entry.body?.map((p, i) => (
        <p key={i} className="log-body">
          {p}
        </p>
      ))}
      {entry.code && (
        <figure className="log-fig">
          <CodeView label={entry.code.caption ?? 'Code excerpt'} lines={entry.code.source.split('\n')} />
          {entry.code.caption && <figcaption>{entry.code.caption}</figcaption>}
        </figure>
      )}
      {entry.image && (
        <figure className="log-fig">
          <img src={entry.image.src} alt={entry.image.alt} />
          {entry.image.caption && <figcaption>{entry.image.caption}</figcaption>}
        </figure>
      )}
      {entry.measurements && entry.measurements.length > 0 && (
        <table className="log-measure">
          <tbody>
            {entry.measurements.map((m) => (
              <tr key={m.label}>
                <th scope="row">{m.label}</th>
                <td className="mono-num">
                  {m.value}
                  {m.unit && <span className="pi-dim"> {m.unit}</span>}
                </td>
                <td className="pi-dim">{m.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

export function ProcessJournal({ presenting }: { presenting: boolean }) {
  const documented = JOURNAL.filter((e) => e.status === 'documented').length;
  const shown = presenting ? JOURNAL.filter((e) => e.status === 'documented') : JOURNAL;

  return (
    <section id="process" className="section" aria-labelledby="process-title">
      <div className="section-head">
        <div className="section-index">
          <b>04</b> / OUR PROCESS
        </div>
        <div>
          <h2 id="process-title" className="section-title">
            Engineering journal
          </h2>
          <p className="prose">
            How we designed, simulated, tested and hardened the chip: what we tried, what broke and what we learned. Every entry is written by the team from real work.
          </p>
        </div>
      </div>

      <div className="journal">
        <nav className="journal-index" aria-label="Journal entries">
          <div className="label">
            {documented} / {JOURNAL.length} entries documented
          </div>
          <ol>
            {JOURNAL.map((e, i) => (
              <li key={e.id} className={e.status}>
                <a href={`#log-${e.id}`}>
                  <span className="ji-dot" aria-hidden="true" />
                  <span className="ji-n">{String(i + 1).padStart(2, '0')}</span>
                  {e.phase}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="journal-entries">
          {shown.length === 0 ? (
            <p className="placeholder">The team has not written any journal entries yet.</p>
          ) : (
            shown.map((e) => <Entry key={e.id} entry={e} n={JOURNAL.indexOf(e) + 1} />)
          )}
          <p className="dev-only journal-dev">
            Edit <code>src/data/project-process.ts</code> to add entries. Pending entries are hidden in presentation mode.
          </p>
        </div>
      </div>
    </section>
  );
}
