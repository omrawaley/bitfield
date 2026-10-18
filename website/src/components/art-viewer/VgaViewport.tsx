import { KeyboardEvent, PointerEvent, RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ArtSimulator, FrameResult } from '../../simulator/simulator-interface';

export interface ViewportProps {
  sim: ArtSimulator;
  ready: boolean;
  running: boolean;
  redrawKey: unknown;
  gridStep: number;
  loupe: boolean;
  integerScale: boolean;
  selected: { x: number; y: number } | null;
  onSelect: (p: { x: number; y: number }) => void;
  onFrame: (r: FrameResult, fps: number) => void;
  onError: (e: unknown) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

const RULER_TOP = 16;
const RULER_LEFT = 30;
const FRAME_MS = 1000 / 60;
const LOUPE_SRC = 15;
const LOUPE_PX = 9;

export function VgaViewport(props: ViewportProps) {
  const { sim, ready, running, redrawKey, gridStep, loupe, integerScale, selected, onSelect, canvasRef } = props;
  const { width: W, height: H } = sim.info;
  const boxRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: W, h: H });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const live = useRef({ running, dirty: true, hover: null as { x: number; y: number } | null, loupe, visible: true });
  live.current.running = running;
  live.current.loupe = loupe;
  live.current.hover = hover;
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    live.current.dirty = true;
  }, [redrawKey, sim, ready]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const availW = Math.max(160, box.clientWidth - RULER_LEFT - 2);
      const availH = Math.max(120, box.clientHeight - RULER_TOP - 2);
      let scale = Math.min(availW / W, availH / H);
      if (integerScale && scale >= 1) scale = Math.floor(scale);
      setSize({ w: Math.floor(W * scale), h: Math.floor(H * scale) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [W, H, integerScale]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const io = new IntersectionObserver(([e]) => {
      live.current.visible = e.isIntersecting;
    });
    io.observe(box);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const image = ctx.createImageData(W, H);
    const pixels = new Uint32Array(image.data.buffer);
    let raf = 0;
    let last = 0;
    let fpsFrames = 0;
    let fpsStart = performance.now();
    let fps = 0;

    const drawLoupe = () => {
      const lc = loupeRef.current;
      const h = live.current.hover;
      if (!lc || !h || !live.current.loupe) return;
      const lctx = lc.getContext('2d')!;
      const half = (LOUPE_SRC - 1) / 2;
      lctx.imageSmoothingEnabled = false;
      lctx.fillStyle = '#000';
      lctx.fillRect(0, 0, lc.width, lc.height);
      lctx.drawImage(canvas, h.x - half, h.y - half, LOUPE_SRC, LOUPE_SRC, 0, 0, lc.width, lc.height);
      lctx.strokeStyle = 'rgba(0,0,0,0.55)';
      lctx.lineWidth = 1;
      lctx.beginPath();
      for (let i = 1; i < LOUPE_SRC; i++) {
        lctx.moveTo(i * LOUPE_PX + 0.5, 0);
        lctx.lineTo(i * LOUPE_PX + 0.5, lc.height);
        lctx.moveTo(0, i * LOUPE_PX + 0.5);
        lctx.lineTo(lc.width, i * LOUPE_PX + 0.5);
      }
      lctx.stroke();
      lctx.strokeStyle = '#d8a16c';
      lctx.strokeRect(half * LOUPE_PX + 0.5, half * LOUPE_PX + 0.5, LOUPE_PX - 1, LOUPE_PX - 1);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const l = live.current;
      if (!l.visible || document.hidden) return;
      const due = l.running && now - last >= FRAME_MS - 1;
      if (!due && !l.dirty) {
        if (l.hover && l.loupe) drawLoupe();
        return;
      }
      try {
        const result = sim.renderFrame(pixels, due);
        ctx.putImageData(image, 0, 0);
        if (due) {
          last = now - ((now - last) % FRAME_MS);
          fpsFrames++;
          if (now - fpsStart >= 500) {
            fps = (fpsFrames * 1000) / (now - fpsStart);
            fpsFrames = 0;
            fpsStart = now;
          }
        }
        l.dirty = false;
        cb.current.onFrame(result, l.running ? fps : 0);
        drawLoupe();
      } catch (e) {
        cancelAnimationFrame(raf);
        cb.current.onError(e);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, ready, W, H, canvasRef]);

  const toSource = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * H);
    return { x: Math.min(W - 1, Math.max(0, x)), y: Math.min(H - 1, Math.max(0, y)) };
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 8 : 1;
    const cur = selected ?? { x: W >> 1, y: H >> 1 };
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      onSelect({ x: Math.min(W - 1, Math.max(0, cur.x + m[0])), y: Math.min(H - 1, Math.max(0, cur.y + m[1])) });
    } else if (e.key === 'Enter' && !selected) {
      onSelect(cur);
    }
  };

  const sx = size.w / W;
  const sy = size.h / H;
  const ticksX = Array.from({ length: W / 32 + 1 }, (_, i) => i * 32);
  const ticksY = Array.from({ length: Math.floor(H / 32) + 1 }, (_, i) => i * 32);

  return (
    <div className="vp-box" ref={boxRef}>
      <div className="vp-frame" style={{ width: size.w + RULER_LEFT, height: size.h + RULER_TOP }}>
        <svg className="vp-ruler vp-ruler-x" width={size.w} height={RULER_TOP} style={{ left: RULER_LEFT }} aria-hidden="true">
          {ticksX.map((t) => (
            <g key={t} transform={`translate(${Math.min(t * sx, size.w - 0.5) + 0.5},0)`}>
              <line y1={t % 128 === 0 ? 4 : 11} y2={RULER_TOP} />
              {t % 128 === 0 && t < W && <text x={3} y={9}>{t}</text>}
            </g>
          ))}
          {hover && <rect className="vp-ruler-cursor" x={hover.x * sx} y={RULER_TOP - 4} width={Math.max(1, sx)} height={4} />}
        </svg>
        <svg className="vp-ruler vp-ruler-y" width={RULER_LEFT} height={size.h} style={{ top: RULER_TOP }} aria-hidden="true">
          {ticksY.map((t) => (
            <g key={t} transform={`translate(0,${Math.min(t * sy, size.h - 0.5) + 0.5})`}>
              <line x1={t % 128 === 0 ? 14 : 23} x2={RULER_LEFT} />
              {t % 128 === 0 && t < H && <text x={1} y={10}>{t}</text>}
            </g>
          ))}
          {hover && <rect className="vp-ruler-cursor" y={hover.y * sy} x={RULER_LEFT - 4} height={Math.max(1, sy)} width={4} />}
        </svg>
        <div
          className="vp-screen"
          style={{ left: RULER_LEFT, top: RULER_TOP, width: size.w, height: size.h }}
          tabIndex={0}
          role="img"
          aria-label={`VGA output, ${W} by ${H} pixels. Click or use arrow keys to probe a pixel.`}
          onKeyDown={onKey}
          onPointerMove={(e) => setHover(toSource(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onSelect(toSource(e as unknown as PointerEvent))}
        >
          <canvas ref={canvasRef} width={W} height={H} className="pixelated" />
          {gridStep > 0 && (
            <div
              className="vp-grid"
              style={{ backgroundSize: `${gridStep * sx}px ${gridStep * sy}px` }}
              aria-hidden="true"
            />
          )}
          {selected && (
            <svg className="vp-cursor" width={size.w} height={size.h} aria-hidden="true">
              <line x1={0} x2={size.w} y1={(selected.y + 0.5) * sy} y2={(selected.y + 0.5) * sy} />
              <line y1={0} y2={size.h} x1={(selected.x + 0.5) * sx} x2={(selected.x + 0.5) * sx} />
              <rect
                x={selected.x * sx - 3}
                y={selected.y * sy - 3}
                width={Math.max(sx, 1) + 6}
                height={Math.max(sy, 1) + 6}
              />
            </svg>
          )}
        </div>
        {loupe && hover && (
          <div className="vp-loupe" style={hover.x > W * 0.6 && hover.y < H * 0.4 ? { left: RULER_LEFT + 8 } : { right: 8 }}>
            <canvas ref={loupeRef} width={LOUPE_SRC * LOUPE_PX} height={LOUPE_SRC * LOUPE_PX} />
            <div className="vp-loupe-read mono-num">
              x {String(hover.x).padStart(3, '0')} · y {String(hover.y).padStart(3, '0')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
