import { useEffect, useMemo, useRef, useState } from 'react';
import { ExprError } from '../../math/expr/ast';
import { CompiledPattern, compilePatternSource, getColorMap } from '../../math/pattern-generators';
import { Button } from '../controls/Controls';
import { CodeView, highlightVerilog } from './CodeView';
import type { LessonView } from './Lessons';
import { useTicker } from './Lessons';

const W = 160;
const H = 120;

const PRESETS = [
  'x ^ y',
  '(x ^ y) + t',
  '(x & y) == 0 ? 8\'hFF : 0',
  '((x >> 3) ^ (y >> 3)) * t',
  'x * y',
  'x * y + 20\'d0 >> 6',
  '(x - 80) * (x - 80) + (y - 60) * (y - 60) >> 4',
  '{x[4:3], y[4:3], t[7:4]}',
];

const SUBSET: [string, string][] = [
  ['signals', 'x [9:0]  y [9:0]  t [7:0]  s [2:0]  k [7:0]'],
  ['literals', "42   8'hFF   4'b1010   10'd640"],
  ['bitwise', '&  |  ^  ~^  ~'],
  ['arithmetic', '+  -  *   (no / or %)'],
  ['shift', '<<  >>'],
  ['compare', '==  !=  <  <=  >  >='],
  ['logic', '&&  ||  !'],
  ['select', 'x[3]   x[7:4]   {a, b}   c ? a : b'],
];

export function usePixelLesson(active: boolean): LessonView {
  const [src, setSrc] = useState('(x ^ y) + t');
  const [last, setLast] = useState<CompiledPattern>(() => compilePatternSource('(x ^ y) + t'));
  const [error, setError] = useState<ExprError | null>(null);
  const [animate, setAnimate] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = useTicker(active && animate && last.expr.identifiers.has('t'));
  const cm = getColorMap('direct');

  useEffect(() => {
    try {
      setLast(compilePatternSource(src));
      setError(null);
    } catch (e) {
      if (e instanceof ExprError) setError(e);
      else throw e;
    }
  }, [src]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    last.render(new Uint32Array(img.data.buffer), W, H, 0, 0, { t, s: 2, k: 128 }, cm.lut);
    ctx.putImageData(img, 0, 0);
  }, [last, t, cm]);

  const widths = useMemo(() => {
    const rows: { text: string; w: number }[] = [];
    const visit = (n: CompiledPattern['expr']['root'], depth: number) => {
      if (depth > 2) return;
      if (n.type !== 'ident' && n.type !== 'num') rows.push({ text: last.expr.source.slice(n.start, n.end).trim(), w: n.w! });
      if (n.type === 'binary') {
        visit(n.left, depth + 1);
        visit(n.right, depth + 1);
      } else if (n.type === 'unary') visit(n.arg, depth + 1);
      else if (n.type === 'ternary') {
        visit(n.then, depth + 1);
        visit(n.else, depth + 1);
      }
    };
    visit(last.expr.root, 0);
    return rows.slice(0, 6);
  }, [last]);

  const code = (
    <div className="pixel-code">
      <CodeView
        label="Verilog context for the editable expression"
        lines={[
          '// supplied by the VGA timing generator and a frame counter',
          'wire [9:0] x = pix_x;',
          'wire [9:0] y = pix_y;',
          'wire [7:0] t = frame;',
          '',
        ]}
      />
      <div className={`expr-editor ${error ? 'has-error' : ''}`}>
        <span className="expr-prefix">
          {highlightVerilog('wire [7:0] v =')}
        </span>
        <div className="expr-field">
          <pre className="expr-highlight" aria-hidden="true">
            {highlightVerilog(src, { errorRange: error ? [error.start, error.end] : undefined })}
            {'\n'}
          </pre>
          <textarea
            value={src}
            onChange={(e) => setSrc(e.target.value.replace(/\n/g, ' '))}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            rows={2}
            aria-label="Editable Verilog expression for v"
            aria-invalid={!!error}
            aria-describedby="expr-status"
          />
        </div>
        <span className="expr-suffix">;</span>
      </div>
      <CodeView label="Colour output" startLine={7} lines={['assign {R, G, B} = {v[5:4], v[3:2], v[1:0]};']} />
      <p id="expr-status" className={`expr-status ${error ? 'err' : 'ok'}`} role="status">
        {error ? (
          <>
            col {error.start + 1}: {error.message} <span className="pi-dim">(showing the last valid expression)</span>
          </>
        ) : (
          <>✓ parsed and evaluated at {last.expr.width} bits, assigned to 8</>
        )}
      </p>
      <div className="presets">
        <span className="label">Try</span>
        {PRESETS.map((p) => (
          <button key={p} type="button" className="preset" onClick={() => setSrc(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  const visual = (
    <div className="lv">
      <div className="lv-toolbar">
        <span className="badge demo">Interpreted in the browser · not compiled</span>
        <span className="lv-grow" />
        <Button onClick={() => setAnimate((a) => !a)} pressed={!animate} disabled={!last.expr.identifiers.has('t')}>
          {last.expr.identifiers.has('t') ? (
            <>
              {animate ? '❚❚' : '▶'} t = {String(t).padStart(3, '0')}
            </>
          ) : (
            't unused'
          )}
        </Button>
      </div>
      <div className="pixel-preview">
        <canvas ref={canvasRef} width={W} height={H} className="pixelated" aria-label={`Preview of v = ${last.expr.source}`} role="img" />
      </div>
      <div className="lv-split even">
        <div>
          <span className="label">Bit widths (Verilog sizing rules)</span>
          <table className="widths">
            <tbody>
              {widths.map((r, i) => (
                <tr key={i}>
                  <td>
                    <code>{r.text}</code>
                  </td>
                  <td className="pi-dec">{r.w} bits</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lv-note">
            Unsized numbers such as <code>80</code> are 32 bits wide in Verilog, so they widen the whole expression. Without one, <code>x * y</code> is only 10 bits wide and loses the top of the product. Try both presets.
          </p>
        </div>
        <div>
          <span className="label">Supported subset</span>
          <dl className="subset">
            {SUBSET.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  <code>{v}</code>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="lv-note">
        This editor accepts one expression from the subset above. A small parser in the page checks it and evaluates it with Verilog’s unsigned width rules. No Verilog toolchain runs here, and full modules are not accepted. The preview fixes s = 2 and k = 128.
      </p>
    </div>
  );

  return { code, visual };
}
