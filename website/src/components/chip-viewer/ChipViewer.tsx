import { KeyboardEvent, PointerEvent, WheelEvent, useRef, useState } from 'react';
import { Button } from '../controls/Controls';
import { ChipLayoutSource, layoutSource } from './layout-source';

function ImageViewer({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) {
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const zoomAt = (factor: number, cx: number, cy: number) =>
    setView((v) => {
      const s = Math.min(40, Math.max(0.5, v.s * factor));
      const k = s / v.s;
      return { s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  const center = () => {
    const r = box.current!.getBoundingClientRect();
    return [r.width / 2, r.height / 2] as const;
  };
  const onWheel = (e: WheelEvent) => {
    const r = box.current!.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  };
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX - view.x, y: e.clientY - view.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (drag.current) setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = 40;
    if (e.key === '+' || e.key === '=') zoomAt(1.25, ...center());
    else if (e.key === '-') zoomAt(0.8, ...center());
    else if (e.key === '0') setView({ s: 1, x: 0, y: 0 });
    else if (e.key === 'ArrowLeft') setView((v) => ({ ...v, x: v.x + step }));
    else if (e.key === 'ArrowRight') setView((v) => ({ ...v, x: v.x - step }));
    else if (e.key === 'ArrowUp') setView((v) => ({ ...v, y: v.y + step }));
    else if (e.key === 'ArrowDown') setView((v) => ({ ...v, y: v.y - step }));
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className="cv-image">
      <div
        className="cv-image-box"
        ref={box}
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={onKey}
        aria-label="Layout render. Drag or use the arrow keys to pan; scroll or press + and − to zoom; press 0 to reset."
      >
        <img src={src} alt={alt} draggable={false} onError={onError} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }} />
      </div>
      <div className="cv-image-tools">
        <Button onClick={() => zoomAt(1.25, ...center())}>＋</Button>
        <Button onClick={() => zoomAt(0.8, ...center())}>－</Button>
        <Button onClick={() => setView({ s: 1, x: 0, y: 0 })}>Reset</Button>
        <span className="cv-zoom mono-num">{view.s.toFixed(2)}×</span>
      </div>
    </div>
  );
}

export function ChipViewer({ source = layoutSource }: { source?: ChipLayoutSource }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="panel chip-viewer">
      <div className="panel-head">
        <span className="tag">VIEWER</span> Physical layout
        <span className="spacer" />
        {imageFailed ? <span className="badge err">Render unavailable</span> : <span className="badge hw">Generated layout · from our flow</span>}
      </div>
      <div className="cv-body">
        <div className="cv-stage">
          {imageFailed ? (
            <div className="cv-empty">
              <div className="cv-empty-grid" aria-hidden="true" />
              <div className="cv-empty-text">
                <p className="cv-empty-title">The generated layout could not be loaded.</p>
                <p>
                  The render is published with this site on GitHub Pages. If it is missing, the Pages deployment has not run yet — every push runs the <code>gds</code> workflow, and its <code>pages</code> job deploys the site, the render and the GDS/OAS files together.
                </p>
              </div>
            </div>
          ) : (
            <ImageViewer src={source.image.src} alt={source.image.alt} onError={() => setImageFailed(true)} />
          )}
          <p className="cv-provenance">Source: {source.generatedBy}</p>
          {source.links && (
            <p className="cv-links">
              {source.links.map((l) => (
                <a key={l.href} className="btn btn-ghost" href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ))}
            </p>
          )}
        </div>
        <aside className="cv-side">
          <h4 className="label">Viewer controls</h4>
          <dl className="cv-planned">
            <div>
              <dt>Drag / arrow keys</dt>
              <dd>pan the render</dd>
            </div>
            <div>
              <dt>Scroll / ＋ −</dt>
              <dd>zoom from 0.5× to 40×</dd>
            </div>
            <div>
              <dt>Reset / 0</dt>
              <dd>return to the default view</dd>
            </div>
          </dl>
          <p className="cv-note">
            For the 3D stack — orbit, layer isolation, explode — open the <strong>3D viewer</strong> link below the render, which loads our submitted <code>.oas</code> into Tiny Tapeout’s viewer. <strong>GDS Explorer</strong> shows every layer of the same file.
          </p>
        </aside>
      </div>
    </div>
  );
}
