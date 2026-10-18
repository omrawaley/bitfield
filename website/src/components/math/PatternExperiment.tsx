import { KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { inspectPixel } from '../../math/pixel-inspector';
import { COLOR_MAPS, PatternDef, getColorMap, getPattern } from '../../math/pattern-generators';
import { Button, RangeField, Segmented, Toggle } from '../controls/Controls';
import { PixelInspector } from './PixelInspector';

const W = 128;
const H = 96;

export const EXPLORER_FORMULAS: PatternDef[] = [
  {
    id: 'xor',
    name: 'X ^ Y',
    expr: 'x ^ y',
    explain:
      'Each result bit is 1 where the bits of x and y differ. Along the diagonal x = y every bit matches, so the value is 0. Bit i flips every 2^i pixels in both directions, so the picture is built from nested squares with power-of-two sides. This is the classic “munching squares” pattern.',
    defaults: { s: 0, k: 0, map: 'direct' },
  },
  {
    id: 'and',
    name: 'X & Y',
    expr: 'x & y',
    explain:
      'A bit is 1 only where both x and y have it. x & y can never be larger than the smaller coordinate, so the image darkens toward the top and left edges. The pixels where x & y = 0 trace Sierpiński’s triangle.',
    defaults: { s: 0, k: 0, map: 'direct' },
  },
  {
    id: 'or',
    name: 'X | Y',
    expr: 'x | y',
    explain:
      'A bit is 1 where either coordinate has it. x | y is always at least the larger coordinate, so values rise toward the right and bottom. Each bit lays a grid of bars over the image, and where they overlap you get the plaid.',
    defaults: { s: 0, k: 0, map: 'direct' },
  },
  {
    id: 'xort',
    name: '(X ^ Y) + t',
    expr: '(x ^ y) + t',
    explain:
      'The same XOR squares plus the time counter t. The shapes stay put while the values under them increase, so the colours cycle. Addition carries ripple from the low bits upward, so the low bits, and the colours they drive, change fastest.',
    defaults: { s: 0, k: 0, map: 'direct' },
  },
  {
    id: 'shift',
    name: '(X >> s) ^ (Y << s)',
    expr: '(x >> s) ^ (y << s)',
    explain:
      'x >> s divides x by 2^s, so each value covers 2^s columns. y << s multiplies y by 2^s, which makes its lowest s bits zero, and in the 10-bit context its top s bits fall off. The low s bits of the result therefore come from x alone and form vertical stripes. Only the higher bits mix x and y. At s = 0 this is plain x ^ y.',
    defaults: { s: 2, k: 0, map: 'direct' },
  },
];

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function PatternExperiment() {
  const [formula, setFormula] = useState(0);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);
  const [s, setS] = useState(2);
  const [t, setT] = useState(0);
  const [mapIdx, setMapIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [grid, setGrid] = useState(true);
  const [sel, setSel] = useState<{ x: number; y: number }>({ x: 5, y: 3 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const def = EXPLORER_FORMULAS[formula];
  const pattern = useMemo(() => getPattern(def), [def]);
  const colorMap = getColorMap(COLOR_MAPS[mapIdx].id);
  const uses = pattern.expr.identifiers;
  const params = useMemo(() => ({ t, s, k: 0 }), [t, s]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    pattern.render(new Uint32Array(img.data.buffer), W, H, ox, oy, params, colorMap.lut);
    ctx.putImageData(img, 0, 0);
  }, [pattern, ox, oy, params, colorMap]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last >= 33) {
        last = now;
        setT((v) => (v + 1) & 255);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const inspection = useMemo(
    () => inspectPixel(pattern, colorMap, (sel.x + ox) & 1023, (sel.y + oy) & 1023, params),
    [pattern, colorMap, sel, ox, oy, params],
  );

  const pick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSel({
      x: Math.min(W - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * W))),
      y: Math.min(H - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * H))),
    });
  };

  const onKey = (e: KeyboardEvent) => {
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    setSel((p) => ({ x: Math.min(W - 1, Math.max(0, p.x + m[0])), y: Math.min(H - 1, Math.max(0, p.y + m[1])) }));
  };

  return (
    <div className="pattern-lab">
      <div className="panel pl-main">
        <div className="panel-head">
          <span className="tag">EXP B</span> Formula → picture
          <span className="spacer" />
          <span className="badge muted">browser evaluation</span>
        </div>
        <div className="pl-formulas">
          <Segmented<number>
            label="Formula"
            value={formula}
            onChange={(i) => {
              setFormula(i);
              setS(EXPLORER_FORMULAS[i].defaults.s);
            }}
            options={EXPLORER_FORMULAS.map((f, i) => ({ value: i, label: <code>{f.name}</code> }))}
          />
        </div>
        <div className="pl-view">
          <div
            className="pl-screen"
            onClick={pick}
            onKeyDown={onKey}
            tabIndex={0}
            role="img"
            aria-label={`${W} by ${H} pixel rendering of v = ${def.expr}. Click a pixel or use arrow keys to inspect it.`}
          >
            <canvas ref={canvasRef} width={W} height={H} className="pixelated" />
            {grid && <div className="pl-grid" aria-hidden="true" />}
            <div
              className="pl-sel"
              aria-hidden="true"
              style={{ left: `${(sel.x / W) * 100}%`, top: `${(sel.y / H) * 100}%`, width: `${100 / W}%`, height: `${100 / H}%` }}
            />
          </div>
          <div className="pl-axis mono-num" aria-hidden="true">
            <span>x = {ox}</span>
            <span>x = {(ox + W - 1) & 1023}</span>
          </div>
        </div>
        <div className="pl-expr">
          <span className="formula-lhs">wire [7:0] v =</span> <code>{def.expr}</code>;
        </div>
        <p className="pl-explain">{def.explain}</p>
        <div className="pl-controls">
          <RangeField label="X₀ · origin x" value={ox} min={0} max={1023} bits={10} onChange={setOx} />
          <RangeField label="Y₀ · origin y" value={oy} min={0} max={1023} bits={10} onChange={setOy} />
          <RangeField label={uses.has('s') ? 'shift s' : 'shift s (unused by this formula)'} value={s} min={0} max={7} bits={3} onChange={setS} />
          <div className="pl-time">
            <RangeField label={uses.has('t') ? 'time t' : 't (unused by this formula)'} value={t} min={0} max={255} bits={8} onChange={setT} />
            <Button onClick={() => setPlaying((p) => !p)} pressed={playing} disabled={!uses.has('t')} title={prefersReducedMotion() ? 'Animates t; respects reduced motion by not starting automatically' : undefined}>
              {playing ? '❚❚' : '▶'} t
            </Button>
          </div>
          <div className="pl-maps">
            <span className="label">Colour map</span>
            <Segmented<number> size="sm" label="Colour map" value={mapIdx} onChange={setMapIdx} options={COLOR_MAPS.map((c, i) => ({ value: i, label: c.name }))} />
            <span className="pl-mapnote">{colorMap.def.note}</span>
          </div>
          <Toggle label="Pixel grid" checked={grid} onChange={setGrid} />
        </div>
      </div>

      <div className="panel pl-inspector">
        <div className="panel-head">
          <span className="tag">EXP C</span> Pixel inspector
        </div>
        <div className="pl-inspector-body">
          <PixelInspector
            inspection={inspection}
            coordinateNote={`Screen column ${sel.x}, row ${sel.y}, plus origin (${ox}, ${oy}). Coordinates are 10-bit counters, so they wrap at 1024.`}
          />
        </div>
      </div>
    </div>
  );
}
