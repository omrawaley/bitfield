import { useState } from 'react';
import { BIT_OPS, BitOp, applyBitOp, bitsOf, droppedBits, filledBits } from '../../math/bitwise';
import { toBinary } from '../../math/expr/evaluate';
import { BitSwitch, RangeField, Segmented } from '../controls/Controls';

const WIDTH = 8;

function OperandRow({
  name,
  value,
  onChange,
  dropped,
  hoverCol,
  setHoverCol,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  dropped?: Set<number>;
  hoverCol: number | null;
  setHoverCol: (c: number | null) => void;
}) {
  const bits = bitsOf(value, WIDTH);
  return (
    <div className="alu-row">
      <span className="alu-name">{name}</span>
      <div className="alu-bits" onMouseLeave={() => setHoverCol(null)}>
        {bits.map((b, i) => (
          <span key={i} className={`alu-col ${hoverCol === i ? 'hover' : ''}`} onMouseEnter={() => setHoverCol(i)}>
            <BitSwitch
              value={b}
              label={`${name} bit ${WIDTH - 1 - i}`}
              onToggle={() => onChange(value ^ (1 << (WIDTH - 1 - i)))}
              highlight={dropped?.has(i) ? 'dropped' : null}
            />
          </span>
        ))}
      </div>
      <span className="alu-dec mono-num">{value}</span>
      <span className="alu-hex mono-num">0x{value.toString(16).toUpperCase().padStart(2, '0')}</span>
    </div>
  );
}

export function BitwiseExperiment() {
  const [a, setA] = useState(0b1011_0110);
  const [b, setB] = useState(0b0110_1100);
  const [n, setN] = useState(2);
  const [op, setOp] = useState<BitOp>('XOR');
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const info = BIT_OPS.find((o) => o.op === op)!;
  const result = applyBitOp(op, a, b, n, WIDTH);
  const rBits = bitsOf(result, WIDTH);
  const aBits = bitsOf(a, WIDTH);
  const bBits = bitsOf(b, WIDTH);
  const isShift = info.operand === 'n';
  const dropped = isShift ? droppedBits(op, n, WIDTH) : undefined;
  const filled = isShift ? filledBits(op, n, WIDTH) : new Set<number>();

  const lit = (v: number) => `8'b${toBinary(v, WIDTH)}`;
  const verilog = info.verilog(lit(a), lit(b), n);

  let colExplain = '';
  if (hoverCol !== null) {
    const bit = WIDTH - 1 - hoverCol;
    if (info.operand === 'b') colExplain = `bit ${bit}:  ${aBits[hoverCol]} ${info.symbol} ${bBits[hoverCol]} = ${rBits[hoverCol]}`;
    else if (op === 'NOT') colExplain = `bit ${bit}:  ~${aBits[hoverCol]} = ${rBits[hoverCol]}`;
    else {
      const src = op === 'SHL' ? bit - n : bit + n;
      colExplain =
        src < 0 || src >= WIDTH
          ? `result bit ${bit}: no source bit, filled with 0`
          : `result bit ${bit} ← A bit ${src} (${aBits[WIDTH - 1 - src]})`;
    }
  }

  return (
    <div className="panel alu">
      <div className="panel-head">
        <span className="tag">EXP A</span> Bitwise operations · 8-bit unsigned
        <span className="spacer" />
        <Segmented<BitOp>
          size="sm"
          label="Operation"
          value={op}
          onChange={setOp}
          options={BIT_OPS.map((o) => ({ value: o.op, label: o.op === 'SHL' ? 'A << n' : o.op === 'SHR' ? 'A >> n' : o.op }))}
        />
      </div>
      <div className="alu-body">
        <div className="alu-grid">
          <div className="alu-row alu-index" aria-hidden="true">
            <span className="alu-name" />
            <div className="alu-bits">
              {aBits.map((_, i) => (
                <span key={i} className={`alu-col ${hoverCol === i ? 'hover' : ''}`}>
                  {WIDTH - 1 - i}
                </span>
              ))}
            </div>
            <span className="alu-dec">dec</span>
            <span className="alu-hex">hex</span>
          </div>
          <OperandRow name="A" value={a} onChange={setA} dropped={dropped} hoverCol={hoverCol} setHoverCol={setHoverCol} />
          {info.operand === 'b' && <OperandRow name="B" value={b} onChange={setB} hoverCol={hoverCol} setHoverCol={setHoverCol} />}
          {isShift && (
            <div className="alu-row">
              <span className="alu-name">n</span>
              <div className="alu-shift">
                <RangeField label="shift amount" value={n} min={0} max={7} bits={3} onChange={setN} />
              </div>
            </div>
          )}
          <div className="alu-rule">
            <span className="alu-op">{info.symbol}</span>
            <span>{info.rule}</span>
          </div>
          <div className="alu-row alu-result">
            <span className="alu-name">=</span>
            <div className="alu-bits" onMouseLeave={() => setHoverCol(null)}>
              {rBits.map((bit, i) => (
                <span key={i} className={`alu-col ${hoverCol === i ? 'hover' : ''}`} onMouseEnter={() => setHoverCol(i)}>
                  <BitSwitch
                    value={bit}
                    label={`result bit ${WIDTH - 1 - i}`}
                    highlight={filled.has(i) ? 'filled' : !isShift && bit !== aBits[i] ? 'changed' : null}
                  />
                </span>
              ))}
            </div>
            <span className="alu-dec mono-num">{result}</span>
            <span className="alu-hex mono-num">0x{result.toString(16).toUpperCase().padStart(2, '0')}</span>
          </div>
          <div className="alu-row alu-index" aria-hidden="true">
            <span className="alu-name" />
            <div className="alu-bits">
              {aBits.map((_, i) => (
                <span key={i} className="alu-col weight">
                  {2 ** (WIDTH - 1 - i)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="alu-side">
          <div>
            <h4 className="label">Verilog</h4>
            <code className="alu-code">
              {verilog}
              <br />
              <span className="pi-dim">// = </span>
              <span className="pi-dec">{lit(result)}</span>
            </code>
          </div>
          {!isShift && <RangeField label="A" value={a} min={0} max={255} onChange={setA} />}
          {info.operand === 'b' && <RangeField label="B" value={b} min={0} max={255} onChange={setB} />}
          {isShift && (
            <p className="alu-math">
              {op === 'SHL'
                ? `A << ${n} = (A × 2^${n}) mod 256 = (${a} × ${2 ** n}) mod 256 = ${result}`
                : `A >> ${n} = ⌊A ÷ 2^${n}⌋ = ⌊${a} ÷ ${2 ** n}⌋ = ${result}`}
            </p>
          )}
          <p className="alu-hint" aria-live="polite">
            {colExplain || 'Click any bit of A or B to flip it. Hover over a column to see how that bit is computed.'}
          </p>
          <ul className="alu-legend">
            {!isShift && (
              <li>
                <span className="lg changed" /> result bit differs from A
              </li>
            )}
            {isShift && (
              <>
                <li>
                  <span className="lg dropped" /> bit falls off the 8-bit result
                </li>
                <li>
                  <span className="lg filled" /> zero shifted in
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
