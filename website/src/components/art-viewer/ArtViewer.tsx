import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { project } from '../../data/project';
import { BrowserDemoSimulator } from '../../simulator/browser-demo';
import type { FrameResult, PixelProbe, SimulatorKind } from '../../simulator/simulator-interface';
import { UO_OUT_PIN_NAMES } from '../../simulator/tinyvga';
import { Button, ControlField, OptionList, RangeField, Segmented, Toggle } from '../controls/Controls';
import { Bin, PixelInspector } from '../math/PixelInspector';
import { useArtSimulator } from './useArtSimulator';
import { VgaViewport } from './VgaViewport';
import './art-viewer.css';

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const GRID_STEPS = [0, 16, 64];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function ArtViewer() {
  const { kind, setKind, sim, status, version, fail } = useArtSimulator('verilog');
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const [running, setRunning] = useState(!reducedMotion);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [gridStep, setGridStep] = useState(0);
  const [loupe, setLoupe] = useState(true);
  const [integerScale, setIntegerScale] = useState(false);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [probe, setProbe] = useState<PixelProbe | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const readout = useRef<{ frame?: HTMLElement | null; t?: HTMLElement | null; fps?: HTMLElement | null }>({});

  const ready = status.state === 'ready';
  const controls = useMemo(() => (ready ? sim.getControls() : []), [sim, ready, version]);
  const demo = sim instanceof BrowserDemoSimulator ? sim : null;
  const pattern = demo?.pattern;

  useEffect(() => sim.setSpeed(SPEEDS[speedIdx]), [sim, speedIdx]);

  const refreshProbe = useCallback(() => {
    if (!selected || !ready) return setProbe(null);
    setProbe(sim.probe(selected.x, selected.y));
  }, [sim, selected, ready]);
  useEffect(refreshProbe, [refreshProbe, version]);

  const hasSelection = selected !== null;
  useEffect(() => {
    const aside = asideRef.current;
    const el = probeRef.current;
    if (!hasSelection || !aside || !el || aside.scrollHeight <= aside.clientHeight) return;
    aside.scrollTo({ top: el.offsetTop - 8, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [hasSelection, reducedMotion]);

  const lastProbeT = useRef(-1);
  const onFrame = useCallback(
    (r: FrameResult, fps: number) => {
      const el = readout.current;
      if (el.frame) el.frame.textContent = String(r.frame).padStart(6, '0');
      if (el.t) el.t.textContent = r.t === undefined ? '—' : String(r.t).padStart(3, '0');
      if (el.fps) el.fps.textContent = fps ? fps.toFixed(0) : '—';
      if (selected && r.t !== lastProbeT.current) {
        lastProbeT.current = r.t ?? -1;
        setProbe(sim.probe(selected.x, selected.y));
      }
    },
    [sim, selected],
  );

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const restart = useCallback(() => {
    sim.reset();
  }, [sim]);

  const screenshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      const name = demo ? `demo-${demo.pattern.def.id}` : 'verilog';
      a.href = URL.createObjectURL(blob);
      a.download = `${project.name.toLowerCase()}-${name}-frame.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }, [demo]);

  const cyclePattern = useCallback(
    (dir: number) => {
      const p = controls.find((c) => c.id === 'pattern');
      if (!p || p.kind !== 'select') return;
      const n = p.options.length;
      sim.setControl('pattern', (sim.getControl('pattern') + dir + n) % n);
    },
    [controls, sim],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      switch (e.key) {
        case ' ':
          if (tag === 'BUTTON') return;
          e.preventDefault();
          setRunning((r) => !r);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'r':
          restart();
          break;
        case 'g':
          setGridStep((g) => GRID_STEPS[(GRID_STEPS.indexOf(g) + 1) % GRID_STEPS.length]);
          break;
        case ']':
          cyclePattern(1);
          break;
        case '[':
          cyclePattern(-1);
          break;
        case 'Escape':
          setSelected(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen, restart, cyclePattern]);

  const switchSource = (k: SimulatorKind) => {
    setSelected(null);
    setKind(k);
  };

  const patternControl = controls.find((c) => c.id === 'pattern');
  const mapControl = controls.find((c) => c.id === 'map');
  const otherControls = controls.filter((c) => c.id !== 'pattern' && c.id !== 'map');

  return (
    <section id="experience" className="hero" aria-label="00 / Experience">
      <div className={`stage ${fullscreen ? 'is-fullscreen' : ''}`} ref={stageRef}>
        <header className="stage-head">
          <div className="stage-title">
            <span className="section-index">
              <b>00</b> / EXPERIENCE
            </span>
            <h1>{project.thesis}</h1>
            <p className="stage-summary">{project.summary}</p>
          </div>
          <div className="stage-source">
            {sim.info.isHardwareModel ? (
              <span className={`badge ${ready ? 'hw' : 'err'}`}>Verilog simulation</span>
            ) : (
              <span className="badge demo">Browser reference demo · not hardware output</span>
            )}
          </div>
        </header>

        <div className="stage-view">
          {status.state === 'error' ? (
            <div className="sim-error" role="alert">
              <span className="badge err">Simulation unavailable</span>
              <p className="sim-error-msg">{status.message}</p>
              {status.checklist.length > 0 && (
                <ol>
                  {status.checklist.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
              )}
              <p className="sim-error-foot">
                No substitute output is shown. To see the formulas running, switch to the browser reference demo, which is clearly labelled.
              </p>
              <Button onClick={() => switchSource('browser-demo')}>Show reference demo</Button>
            </div>
          ) : (
            <VgaViewport
              sim={sim}
              ready={ready}
              running={running}
              redrawKey={version}
              gridStep={gridStep}
              loupe={loupe}
              integerScale={integerScale}
              selected={selected}
              onSelect={setSelected}
              onFrame={onFrame}
              onError={fail}
              canvasRef={canvasRef}
            />
          )}
        </div>

        <footer className="stage-foot">
          <div className="formula" aria-label="Active formula">
            {pattern ? (
              <>
                <span className="formula-lhs">v =</span>
                <code>{pattern.expr.source}</code>
              </>
            ) : (
              <span className="formula-lhs">{sim.info.isHardwareModel ? 'pixels decoded from uo_out[7:0]' : ''}</span>
            )}
          </div>
          <dl className="readouts mono-num">
            <div>
              <dt>FRAME</dt>
              <dd ref={(el) => void (readout.current.frame = el)}>000000</dd>
            </div>
            <div>
              <dt>t</dt>
              <dd ref={(el) => void (readout.current.t = el)}>—</dd>
            </div>
            <div>
              <dt>FPS</dt>
              <dd ref={(el) => void (readout.current.fps = el)}>—</dd>
            </div>
            <div className="hide-sm">
              <dt>OUT</dt>
              <dd>
                {sim.info.width}×{sim.info.height} · {sim.info.format}
              </dd>
            </div>
          </dl>
        </footer>
      </div>

      <aside className="instrument" aria-label="Instrument controls" ref={asideRef}>
        <div className="inst-group">
          <h2 className="label">Source</h2>
          <Segmented<SimulatorKind>
            label="Pixel source"
            value={kind}
            onChange={switchSource}
            options={[
              { value: 'verilog', label: 'Verilog sim' },
              { value: 'browser-demo', label: 'Reference demo' },
            ]}
          />
          <p className="inst-note">{sim.info.disclosure}</p>
        </div>

        <div className="inst-group">
          <h2 className="label">Transport</h2>
          <div className="inst-row">
            <Button variant="primary" onClick={() => setRunning((r) => !r)} disabled={!ready} kbd="␣" pressed={!running}>
              {running ? '❚❚ Pause' : '▶ Run'}
            </Button>
            {sim.capabilities.restart && (
              <Button onClick={restart} disabled={!ready} kbd="R">
                ↺ Restart
              </Button>
            )}
          </div>
          <div className="inst-row">
            <Button onClick={toggleFullscreen} kbd="F" disabled={!ready}>
              ⤢ Fullscreen
            </Button>
            <Button onClick={screenshot} disabled={!ready} title="Save the current frame as a 640×480 PNG">
              ⇩ PNG
            </Button>
          </div>
          {reducedMotion && !running && <p className="inst-note">Animation starts paused because your system asks for reduced motion.</p>}
        </div>

        {patternControl && patternControl.kind === 'select' && (
          <div className="inst-group">
            <h2 className="label">
              Pattern <kbd>[</kbd> <kbd>]</kbd>
            </h2>
            <OptionList
              label="Pattern"
              options={patternControl.options}
              value={sim.getControl('pattern')}
              onChange={(v) => {
                sim.setControl('pattern', v);
              }}
            />
          </div>
        )}

        {(otherControls.length > 0 || sim.capabilities.speed) && (
          <div className="inst-group">
            <h2 className="label">{sim.info.isHardwareModel ? 'Inputs · ui_in' : 'Parameters'}</h2>
            <div className={sim.info.isHardwareModel && otherControls.every((c) => c.kind === 'toggle') ? 'inst-toggles' : 'inst-stack'}>
              {otherControls.map((c) => (
                <ControlField key={c.id} control={c} value={sim.getControl(c.id)} onChange={(v) => sim.setControl(c.id, v)} />
              ))}
            </div>
            {sim.capabilities.speed && (
              <RangeField
                label="Speed (t per frame)"
                value={speedIdx}
                min={0}
                max={SPEEDS.length - 1}
                format={(i) => `×${SPEEDS[i]}`}
                onChange={setSpeedIdx}
              />
            )}
          </div>
        )}

        {mapControl && mapControl.kind === 'select' && (
          <div className="inst-group">
            <h2 className="label">Colour map · v[7:0] → RGB222</h2>
            <Segmented<number>
              size="sm"
              label="Colour map"
              value={sim.getControl('map')}
              onChange={(v) => sim.setControl('map', v)}
              options={mapControl.options}
            />
          </div>
        )}

        <div className="inst-group">
          <h2 className="label">Display</h2>
          <div className="inst-row wrap">
            <Segmented<number>
              size="sm"
              label="Grid overlay"
              value={gridStep}
              onChange={setGridStep}
              options={GRID_STEPS.map((g) => ({ value: g, label: g === 0 ? 'No grid' : `${g}px` }))}
            />
            <Toggle label="Loupe" checked={loupe} onChange={setLoupe} />
            <Toggle label="Integer scale" checked={integerScale} onChange={setIntegerScale} />
          </div>
        </div>

        <div className="inst-group probe" ref={probeRef}>
          <h2 className="label">Pixel probe</h2>
          {!probe && <p className="inst-note">Click the image, or focus it and use the arrow keys, to see how one pixel is computed.</p>}
          {probe?.kind === 'expression' && (
            <>
              <PixelInspector inspection={probe.inspection} compact />
              {pattern?.def.explain && <p className="inst-note why">{pattern.def.explain}</p>}
            </>
          )}
          {probe?.kind === 'pins' && (
            <div className="pin-probe">
              <div className="mono-num">
                pixel ({probe.x}, {probe.y})
              </div>
              <div>
                uo_out = <Bin value={probe.uoOut} width={8} tone="result" />
              </div>
              <div className="pin-names">{UO_OUT_PIN_NAMES.slice().reverse().join(' ')}</div>
              <div>
                R {probe.rgb[0]} · G {probe.rgb[1]} · B {probe.rgb[2]}
              </div>
              <p className="inst-note">The simulation only exposes output pins, so internal signals are not available here.</p>
            </div>
          )}
          {probe && (
            <Button variant="ghost" onClick={() => setSelected(null)} kbd="Esc">
              Clear probe
            </Button>
          )}
        </div>
      </aside>
    </section>
  );
}

