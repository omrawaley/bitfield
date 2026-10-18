import { KeyboardEvent, PointerEvent, WheelEvent, useRef, useState } from 'react';
import { Button } from '../controls/Controls';
import { ChipLayoutSource, layoutSource } from './layout-source';

const PLANNED_CONTROLS = [
  ['Rotate / pan / zoom', 'orbit camera around the die'],
  ['2D ⇄ 3D', 'top-down plan or perspective stack'],
  ['Layers', 'show / hide each process layer'],
  ['Isolate', 'solo one layer, e.g. met1'],
  ['Opacity', 'per-layer transparency'],
  ['Explode', 'separate layers vertically'],
  ['Reset camera', 'return to the default view'],
];

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

export function ChipViewer({ source = layoutSource }: { source?: ChipLayoutSource | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = source?.image && !imageFailed ? source.image : null;
  return (
    <div className="panel chip-viewer">
      <div className="panel-head">
        <span className="tag">VIEWER</span> Physical layout
        <span className="spacer" />
        {image ? (
          <span className="badge hw">Generated layout · from our flow</span>
        ) : source?.image ? (
          <span className="badge muted">Awaiting first GDS build</span>
        ) : (
          <span className="badge muted">Not connected</span>
        )}
      </div>
      <div className="cv-body">
        <div className="cv-stage">
          {image ? (
            <ImageViewer src={image.src} alt={image.alt} onError={() => setImageFailed(true)} />
          ) : (
            <div className="cv-empty">
              <div className="cv-empty-grid" aria-hidden="true" />
              <div className="cv-empty-text">
                {source?.image ? (
                  <>
                    <p className="cv-empty-title">The layout render will appear here.</p>
                    <p>
                      Every push runs the Tiny Tapeout GDS action, and its <code>viewer</code> job publishes the rendered layout to GitHub Pages. The first successful build — with Pages enabled once in the repository settings — turns this on automatically.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="cv-empty-title">Our physical layout will appear here.</p>
                    <p>
                      Once the design has been hardened, this viewer will show the GDS layout produced by our flow. That is a <strong>generated physical design</strong>, not a photograph of a fabricated chip. Until then nothing is shown here, rather than a made-up layout.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          {source && <p className="cv-provenance">Source: {source.generatedBy}</p>}
          {source?.links && (
            <p className="cv-links">
              {source.links.map((l) => (
                <a key={l.href} className="btn btn-ghost" href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ))}
            </p>
          )}
          {source?.model && (
            <p className="cv-provenance">A 3D model is configured ({source.model.src}), but the 3D renderer has not been built yet.</p>
          )}
        </div>
        <aside className="cv-side">
          <h4 className="label">Planned viewer controls</h4>
          <dl className="cv-planned">
            {PLANNED_CONTROLS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="dev-only cv-integrate">
            <h4 className="label">Integration</h4>
            <ol>
              <li>
                Every push runs the <code>gds</code> workflow; its <code>viewer</code> job publishes <code>gds_render.png</code>, the <code>.gds</code> and the <code>.oas</code> to GitHub Pages.
              </li>
              <li>
                The published image URL is configured in <code>src/components/chip-viewer/layout-source.ts</code>; the 2D viewer turns on by itself after the first deploy.
              </li>
              <li>
                The 3D links open Tiny Tapeout’s GDS viewer / explorer with the published <code>.oas</code>.
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
