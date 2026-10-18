import { ReactNode, useEffect, useRef, useState } from 'react';
import { bitsOf } from '../../math/bitwise';
import { toBinary } from '../../math/expr/evaluate';
import { BitSwitch, Button, RangeField, Segmented, Toggle } from '../controls/Controls';
import { CodeView } from './CodeView';
import { Gate, GateDiagram } from './GateDiagram';
import { Waveform } from './Waveform';

export interface LessonView {
  code: ReactNode;
  visual: ReactNode;
}

const GATE_OPS: Record<Gate, { sym: string; fn: (a: number, b: number) => number }> = {
  AND: { sym: '&', fn: (a, b) => a & b },
  OR: { sym: '|', fn: (a, b) => a | b },
  XOR: { sym: '^', fn: (a, b) => a ^ b },
};

export function useGateLesson(): LessonView {
  const [gate, setGate] = useState<Gate>('XOR');
  const [a, setA] = useState(1);
  const [b, setB] = useState(0);
  const [history, setHistory] = useState<{ a: number; b: number }[]>([{ a: 1, b: 0 }]);
  const { sym, fn } = GATE_OPS[gate];
  const y = fn(a, b);

  const set = (na: number, nb: number) => {
    setA(na);
    setB(nb);
    setHistory((h) => [...h.slice(-15), { a: na, b: nb }]);
  };

  const code = (
    <CodeView
      label="Verilog for a two-input gate"
      lines={[
        'module gate (',
        '    input  wire a,',
        '    input  wire b,',
        '    output wire y',
        ');',
        { text: `    assign y = a ${sym} b;   // ${gate}`, active: true },
        'endmodule',
      ]}
    />
  );

  const visual = (
    <div className="lv">
      <div className="lv-toolbar">
        <Segmented<Gate> label="Gate type" value={gate} onChange={setGate} options={(['AND', 'OR', 'XOR'] as Gate[]).map((g) => ({ value: g, label: g }))} />
      </div>
      <GateDiagram gate={gate} a={a} b={b} y={y} onToggleA={() => set(a ^ 1, b)} onToggleB={() => set(a, b ^ 1)} />
      <div className="lv-split">
        <div>
        <span className="label">Truth table · y = a {sym} b</span>
        <table className="truth" aria-label={`Truth table for y = a ${sym} b`}>
          <thead>
            <tr>
              <th>a</th>
              <th>b</th>
              <th>y</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1].flatMap((ra) =>
              [0, 1].map((rb) => (
                <tr key={`${ra}${rb}`} className={ra === a && rb === b ? 'current' : ''} onClick={() => set(ra, rb)}>
                  <td>{ra}</td>
                  <td>{rb}</td>
                  <td className={fn(ra, rb) ? 'one' : ''}>{fn(ra, rb)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        </div>
        <div className="lv-wave">
          <span className="label">Input history</span>
          <Waveform
            label="Waveform of a, b and y over the last input changes"
            steps={16}
            stepWidth={18}
            signals={[
              { name: 'a', kind: 'bit', values: pad(history.map((h) => h.a)) },
              { name: 'b', kind: 'bit', values: pad(history.map((h) => h.b)) },
              { name: 'y', kind: 'bit', values: pad(history.map((h) => fn(h.a, h.b))), tone: 'out' },
            ]}
          />
        </div>
      </div>
    </div>
  );
  return { code, visual };
}

function pad(values: number[], n = 16) {
  if (values.length >= n) return values.slice(-n);
  return [...Array(n - values.length).fill(values[0] ?? 0), ...values];
}

export function useShiftLesson(): LessonView {
  const [a, setA] = useState(0b1011_0010);
  const [n, setN] = useState(2);
  const [dir, setDir] = useState<'<<' | '>>'>('<<');
  const W = 8;
  const result = dir === '<<' ? (a << n) & 0xff : a >>> n;
  const aBits = bitsOf(a, W);
  const cell = 34;

  const code = (
    <CodeView
      label="Verilog for a shift"
      lines={[
        `wire [7:0] a = 8'b${toBinary(a, 8)};`,
        `wire [2:0] n = 3'd${n};`,
        { text: `wire [7:0] y = a ${dir} n;    // = 8'b${toBinary(result, 8)}`, active: true },
      ]}
    />
  );

  const visual = (
    <div className="lv">
      <div className="lv-toolbar">
        <Segmented<'<<' | '>>'> label="Shift direction" value={dir} onChange={setDir} options={[{ value: '<<', label: 'a << n' }, { value: '>>', label: 'a >> n' }]} />
        <div className="lv-grow">
          <RangeField label="n" value={n} min={0} max={7} bits={3} onChange={setN} />
        </div>
      </div>
      <div className="shift-stage" style={{ width: W * cell }}>
        <div className="shift-row">
          <span className="shift-lbl">a</span>
          {aBits.map((bit, i) => (
            <BitSwitch key={i} value={bit} label={`a bit ${W - 1 - i}`} onToggle={() => setA(a ^ (1 << (W - 1 - i)))} />
          ))}
        </div>
        <div className="shift-lane" aria-hidden="true">
          {aBits.map((bit, i) => {
            const raw = dir === '<<' ? i - n : i + n;
            const off = raw < 0 || raw >= W;
            const dest = Math.max(-1, Math.min(W, raw));
            return (
              <span
                key={i}
                className={`bit ${bit ? 'one' : 'zero'} ${off ? 'dropped' : ''} shift-mover`}
                style={{ transform: `translateX(${dest * cell}px)`, opacity: off ? 0.35 : 1 }}
              >
                {bit}
              </span>
            );
          })}
          {Array.from({ length: Math.min(n, W) }, (_, k) => {
            const pos = dir === '<<' ? W - 1 - k : k;
            return (
              <span key={`z${k}`} className="bit filled shift-mover" style={{ transform: `translateX(${pos * cell}px)` }}>
                0
              </span>
            );
          })}
          <span className="shift-edge left" />
          <span className="shift-edge right" />
        </div>
        <div className="shift-row result">
          <span className="shift-lbl">y</span>
          {bitsOf(result, W).map((bit, i) => (
            <BitSwitch key={i} value={bit} label={`y bit ${W - 1 - i}`} />
          ))}
        </div>
      </div>
      <p className="lv-math mono-num">
        {dir === '<<' ? `${a} × 2^${n} = ${a * 2 ** n}` : `⌊${a} ÷ 2^${n}⌋ = ${result}`}
        {dir === '<<' && a * 2 ** n > 255 && <span className="lv-warn"> → only 8 bits fit: {a * 2 ** n} mod 256 = {result}</span>}
      </p>
      <ul className="alu-legend">
        <li>
          <span className="lg dropped" /> bit pushed outside the 8-bit wire
        </li>
        <li>
          <span className="lg filled" /> zero filled in
        </li>
      </ul>
    </div>
  );
  return { code, visual };
}

interface RegState {
  clk: number;
  rst_n: number;
  en: number;
  d: number;
  q: number;
}

export function useRegisterLesson(): LessonView {
  const [mode, setMode] = useState<'load' | 'count'>('load');
  const [s, setS] = useState<RegState>({ clk: 0, rst_n: 1, en: 1, d: 0b0101, q: 0 });
  const [trace, setTrace] = useState<RegState[]>([{ clk: 0, rst_n: 1, en: 1, d: 0b0101, q: 0 }]);
  const [lastEdge, setLastEdge] = useState<'reset' | 'load' | 'hold' | null>(null);

  const record = (next: RegState) => {
    setS(next);
    setTrace((t) => [...t.slice(-23), next]);
  };

  const halfCycle = () => {
    const rising = s.clk === 0;
    let q = s.q;
    if (rising) {
      if (!s.rst_n) {
        q = 0;
        setLastEdge('reset');
      } else if (s.en) {
        q = mode === 'load' ? s.d : (s.q + 1) & 0xf;
        setLastEdge('load');
      } else setLastEdge('hold');
    }
    record({ ...s, clk: rising ? 1 : 0, q });
  };

  const setInput = (patch: Partial<RegState>) => record({ ...s, ...patch });

  const markers = trace.map((t, i) => (i > 0 && t.clk === 1 && trace[i - 1].clk === 0 ? i : -1)).filter((i) => i >= 0);

  const code = (
    <CodeView
      label="Verilog for a 4-bit register"
      lines={[
        'module reg4 (',
        '    input  wire       clk,',
        '    input  wire       rst_n,',
        '    input  wire       en,',
        '    input  wire [3:0] d,',
        '    output reg  [3:0] q',
        ');',
        { text: '    always @(posedge clk) begin', active: lastEdge !== null },
        { text: "        if (!rst_n)   q <= 4'd0;", active: lastEdge === 'reset' },
        { text: mode === 'load' ? '        else if (en)  q <= d;' : "        else if (en)  q <= q + 4'd1;", active: lastEdge === 'load' },
        '    end',
        'endmodule',
      ]}
    />
  );

  const visual = (
    <div className="lv">
      <div className="lv-toolbar">
        <Segmented<'load' | 'count'> label="Register behaviour" value={mode} onChange={setMode} options={[{ value: 'load', label: 'q <= d' }, { value: 'count', label: 'q <= q + 1' }]} />
      </div>
      <div className="reg-panel">
        <div className="reg-inputs">
          <Toggle label="rst_n" checked={!!s.rst_n} onChange={(v) => setInput({ rst_n: v ? 1 : 0 })} />
          <Toggle label="en" checked={!!s.en} onChange={(v) => setInput({ en: v ? 1 : 0 })} />
          {mode === 'load' && (
            <div className="reg-d">
              <span className="label">d[3:0]</span>
              {bitsOf(s.d, 4).map((bit, i) => (
                <BitSwitch key={i} value={bit} label={`d bit ${3 - i}`} onToggle={() => setInput({ d: s.d ^ (1 << (3 - i)) })} />
              ))}
            </div>
          )}
        </div>
        <div className="reg-box" aria-live="polite">
          <span className="label">q[3:0]</span>
          <div className="reg-q">
            {bitsOf(s.q, 4).map((bit, i) => (
              <BitSwitch key={i} value={bit} label={`q bit ${3 - i}`} />
            ))}
          </div>
          <span className="pi-dec mono-num">= {s.q}</span>
        </div>
        <div className="reg-clock">
          <Button variant="primary" onClick={halfCycle}>
            {s.clk === 0 ? 'clk 0 → 1  (rising edge)' : 'clk 1 → 0  (falling edge)'}
          </Button>
          <span className={`reg-clk-led ${s.clk ? 'on' : ''}`} aria-label={`clk is ${s.clk}`} />
        </div>
      </div>
      <p className="lv-status">
        {lastEdge === null && 'Change the inputs, then raise the clock.'}
        {lastEdge === 'reset' && 'Rising edge with rst_n = 0: q is cleared to 0.'}
        {lastEdge === 'load' && (mode === 'load' ? 'Rising edge: q captured d.' : 'Rising edge: q incremented. It wraps from 15 back to 0.')}
        {lastEdge === 'hold' && 'Rising edge with en = 0: q kept its value.'}
      </p>
      <Waveform
        label="Waveform of clock, inputs and register output"
        steps={24}
        stepWidth={20}
        markers={markers}
        signals={[
          { name: 'clk', kind: 'bit', values: padTrace(trace.map((t) => t.clk)), tone: 'clock' },
          { name: 'rst_n', kind: 'bit', values: padTrace(trace.map((t) => t.rst_n)) },
          { name: 'en', kind: 'bit', values: padTrace(trace.map((t) => t.en)) },
          ...(mode === 'load' ? [{ name: 'd', kind: 'bus' as const, values: padTrace(trace.map((t) => t.d)) }] : []),
          { name: 'q', kind: 'bus', values: padTrace(trace.map((t) => t.q)), tone: 'out' },
        ]}
      />
    </div>
  );
  return { code, visual };
}

function padTrace(values: number[]) {
  return pad(values, 24);
}

export function useTicker(active: boolean, fps = 30) {
  const [tick, setTick] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last >= 1000 / fps) {
        last = now;
        ref.current = (ref.current + 1) & 255;
        setTick(ref.current);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, fps]);
  return tick;
}

