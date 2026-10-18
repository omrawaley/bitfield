import { KeyboardEvent, useState } from 'react';
import { SILICON_STAGES } from '../../data/silicon-stages';
import { StageVisual } from './StageVisual';
import './silicon.css';

export function SiliconSection() {
  const [active, setActive] = useState(0);
  const stage = SILICON_STAGES[active];

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setActive((a) => Math.min(SILICON_STAGES.length - 1, a + 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else return;
    e.preventDefault();
  };

  return (
    <section id="silicon" className="section" aria-labelledby="silicon-title">
      <div className="section-head">
        <div className="section-index">
          <b>03</b> / FROM CODE TO SILICON
        </div>
        <div>
          <h2 id="silicon-title" className="section-title">
            How a formula becomes geometry
          </h2>
          <p className="prose">
            A chip design passes through a chain of transformations. Each stage keeps the behaviour the same while making the description more physical, until all that is left is polygons on stacked layers of a silicon process.
          </p>
        </div>
      </div>

      <ol className="flow" role="tablist" aria-label="Design flow stages" onKeyDown={onKey}>
        {SILICON_STAGES.map((s, i) => (
          <li key={s.id} role="presentation" className={i < active ? 'done' : i === active ? 'on' : ''}>
            <button
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls="flow-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
            >
              <span className="flow-idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="flow-name">{s.name}</span>
              <span className="flow-tf">{s.transform}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="flow-panel panel" id="flow-panel" role="tabpanel" aria-label={stage.name}>
        <div className="flow-text">
          <h3>
            <span className="flow-idx">{String(active + 1).padStart(2, '0')}</span> {stage.name}
          </h3>
          <p className="flow-explain">{stage.explain}</p>
          <dl className="flow-meta">
            <div>
              <dt>What changes</dt>
              <dd>{stage.changes}</dd>
            </div>
            <div>
              <dt>Typical tools</dt>
              <dd>{stage.tools}</dd>
            </div>
          </dl>
          <div className="flow-artifact">
            <h4 className="label">Our artifact</h4>
            {stage.artifacts.length === 0 ? (
              <p className="placeholder">
                <b>Awaiting:</b> {stage.awaiting}. <span className="dev-only">Add it to <code>src/data/silicon-stages.ts</code>.</span>
              </p>
            ) : (
              stage.artifacts.map((a, i) => (
                <figure key={i} className="artifact">
                  {a.kind === 'image' ? <img src={a.src} alt={a.caption} /> : <pre>{a.content}</pre>}
                  <figcaption>{a.caption}</figcaption>
                </figure>
              ))
            )}
          </div>
          <div className="flow-nav">
            <button type="button" className="btn btn-ghost" disabled={active === 0} onClick={() => setActive(active - 1)}>
              ← previous
            </button>
            <button type="button" className="btn btn-ghost" disabled={active === SILICON_STAGES.length - 1} onClick={() => setActive(active + 1)}>
              next →
            </button>
          </div>
        </div>
        <StageVisual id={stage.id} />
      </div>

      <p className="flow-jump">
        The end result of this flow, our physical layout, is shown at the top of the page, right below the artwork.{' '}
        <a href="#layout">Go to the layout viewer ↑</a>
      </p>
    </section>
  );
}
