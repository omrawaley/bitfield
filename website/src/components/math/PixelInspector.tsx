import { Fragment } from 'react';
import { TraceStep, toBinary } from '../../math/expr/evaluate';
import type { PixelInspection } from '../../math/pixel-inspector';
import './pixel-inspector.css';

export function Bin({ value, width, tone = 'plain' }: { value: number; width: number; tone?: 'plain' | 'result' }) {
  const s = toBinary(value, width);
  return (
    <span className={`bin-str ${tone}`} aria-label={`binary ${s}`}>
      {s.split('').map((c, i) => (
        <span key={i} className={`${c === '1' ? 'b1' : 'b0'}${(width - i) % 4 === 0 && i !== 0 ? ' nib' : ''}`}>
          {c}
        </span>
      ))}
    </span>
  );
}

const SELF_AMOUNT = new Set(['<<', '>>']);
const COMPARE = new Set(['==', '!=', '<', '<=', '>', '>=', '&&', '||']);

function StepView({ step, index }: { step: TraceStep; index: number }) {
  const w = step.width;
  const binaryOps = !COMPARE.has(step.op) && step.op !== '?:' && step.op !== '{}' && step.op !== '[]';
  return (
    <li className="pi-step">
      <div className="pi-step-head">
        <span className="pi-n">{String(index + 1).padStart(2, '0')}</span>
        <span className="pi-op">{step.label}</span>
        <code className="pi-src" title={step.text}>
          {step.text}
        </code>
        <span className="pi-w">{w}b</span>
      </div>
      <div className="pi-rows">
        {step.op === '[]' ? (
          <>
            <span className="pi-k">{step.operands[0].text}</span>
            <Bin value={step.operands[0].value} width={step.operands[0].width} />
            <span className="pi-k">=</span>
            <span>
              <Bin value={step.value} width={w} tone="result" /> <span className="pi-dec">{step.value}</span>
            </span>
          </>
        ) : binaryOps ? (
          <>
            {step.operands.map((o, i) =>
              i === 1 && SELF_AMOUNT.has(step.op) ? (
                <Fragment key={i}>
                  <span className="pi-k">{step.op}</span>
                  <span className="pi-dec">
                    {o.value} <span className="pi-dim">({o.text})</span>
                  </span>
                </Fragment>
              ) : (
                <Fragment key={i}>
                  <span className="pi-k">{step.operands.length === 2 && i === 1 ? step.op : i === 0 && step.operands.length === 1 ? step.op.replace('u', '') : ''}</span>
                  <span>
                    <Bin value={o.value} width={w} /> <span className="pi-dim">{o.value}</span>
                  </span>
                </Fragment>
              ),
            )}
            <span className="pi-k">=</span>
            <span>
              <Bin value={step.value} width={w} tone="result" /> <span className="pi-dec">{step.value}</span>
            </span>
          </>
        ) : step.op === '?:' ? (
          <>
            <span className="pi-k">if</span>
            <span className="pi-dec">
              {step.operands[0].value ? 'true' : 'false'} <span className="pi-dim">({step.operands[0].text})</span>
            </span>
            <span className="pi-k">=</span>
            <span className="pi-dec">{step.value}</span>
          </>
        ) : (
          <>
            {step.operands.map((o, i) => (
              <Fragment key={i}>
                <span className="pi-k">{i === 0 ? '' : step.op === '{}' ? ',' : step.op}</span>
                <span className="pi-dec">
                  {step.op === '{}' ? <Bin value={o.value} width={o.width} /> : o.value}
                </span>
              </Fragment>
            ))}
            <span className="pi-k">=</span>
            <span className="pi-dec">{step.op === '{}' ? <Bin value={step.value} width={w} tone="result" /> : step.value}</span>
          </>
        )}
      </div>
      {step.note && <p className="pi-note">{step.note}</p>}
    </li>
  );
}

export function PixelInspector({
  inspection,
  compact = false,
  coordinateNote,
}: {
  inspection: PixelInspection;
  compact?: boolean;
  coordinateNote?: string;
}) {
  const { trace, channels, hex, value } = inspection;
  return (
    <div className={`pi ${compact ? 'compact' : ''}`} aria-live="polite">
      <div className="pi-head">
        <span className="pi-swatch" style={{ background: hex }} aria-hidden="true" />
        <div>
          <div className="pi-coord mono-num">
            pixel ({inspection.x}, {inspection.y})
          </div>
          <div className="pi-sub">
            v = {value} → {hex}
          </div>
        </div>
      </div>

      <section>
        <h4 className="label">1 · inputs</h4>
        <dl className="pi-inputs">
          {trace.inputs.map((i) => (
            <Fragment key={i.name}>
              <dt>{i.name}</dt>
              <dd>
                <span className="pi-dec">{i.value}</span>
                <Bin value={i.value} width={i.width} />
                {!compact && <span className="pi-dim">{i.description}</span>}
              </dd>
            </Fragment>
          ))}
        </dl>
        {coordinateNote && <p className="pi-note">{coordinateNote}</p>}
      </section>

      <section>
        <h4 className="label">2 · evaluate {inspection.expression}</h4>
        {trace.steps.length === 0 ? (
          <p className="pi-note">The expression is a single signal; no operations to perform.</p>
        ) : (
          <ol className="pi-steps">
            {trace.steps.map((s, i) => (
              <StepView key={i} step={s} index={i} />
            ))}
          </ol>
        )}
      </section>

      <section>
        <h4 className="label">3 · assign wire [7:0] v</h4>
        <div className="pi-assign">
          <Bin value={trace.rawValue} width={trace.rootWidth} />
          {trace.rootWidth > trace.lhsWidth && <span className="pi-dim"> → keep bits [7:0] →</span>}
          <span>
            <Bin value={value} width={8} tone="result" /> <span className="pi-dec">= {value}</span>
          </span>
        </div>
      </section>

      <section>
        <h4 className="label">4 · colour map {inspection.colorMap.def.name}</h4>
        <table className="pi-color">
          <tbody>
            {channels.map((c) => (
              <tr key={c.name}>
                <th scope="row" className={`ch-${c.name}`}>
                  {c.name}
                </th>
                <td>
                  <code>{c.source}</code>
                </td>
                <td>
                  <Bin value={c.level} width={2} tone="result" />
                </td>
                <td className="pi-dim">level {c.level}/3</td>
                <td className="pi-dec">{c.intensity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pi-note">
          The two bits of each channel drive the TinyVGA PMOD’s resistor DAC, which sets one of four voltage levels. We draw those levels as 0, 85, 170 and 255.
        </p>
      </section>
    </div>
  );
}
