export type Gate = 'AND' | 'OR' | 'XOR';

export function GateDiagram({ gate, a, b, y, onToggleA, onToggleB }: { gate: Gate; a: number; b: number; y: number; onToggleA: () => void; onToggleB: () => void }) {
  const body =
    gate === 'AND'
      ? 'M150,40 L190,40 A40,40 0 0 1 190,120 L150,120 Z'
      : 'M146,40 Q206,40 236,80 Q206,120 146,120 Q170,80 146,40 Z';
  const outX = gate === 'AND' ? 230 : 236;
  const wire = (v: number) => `gd-wire ${v ? 'hi' : 'lo'}`;
  return (
    <svg className="gate" viewBox="0 0 340 160" role="img" aria-label={`${gate} gate: a=${a}, b=${b}, y=${y}`}>
      <line className={wire(a)} x1={60} y1={60} x2={gate === 'AND' ? 150 : 158} y2={60} />
      <line className={wire(b)} x1={60} y1={100} x2={gate === 'AND' ? 150 : 158} y2={100} />
      {gate === 'XOR' && <path className="gd-body-line" d="M134,40 Q158,80 134,120" />}
      <path className="gd-body" d={body} />
      <text className="gd-name" x={gate === 'AND' ? 186 : 186} y={84} textAnchor="middle">
        {gate}
      </text>
      <line className={wire(y)} x1={outX} y1={80} x2={290} y2={80} />

      <g className="gd-switch" role="button" tabIndex={0} aria-label={`input a = ${a}, toggle`} onClick={onToggleA} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggleA())}>
        <rect x={14} y={46} width={46} height={28} className={a ? 'on' : ''} />
        <text x={37} y={65} textAnchor="middle">a={a}</text>
      </g>
      <g className="gd-switch" role="button" tabIndex={0} aria-label={`input b = ${b}, toggle`} onClick={onToggleB} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggleB())}>
        <rect x={14} y={86} width={46} height={28} className={b ? 'on' : ''} />
        <text x={37} y={105} textAnchor="middle">b={b}</text>
      </g>
      <circle className={`gd-led ${y ? 'on' : ''}`} cx={304} cy={80} r={12} />
      <text className="gd-out" x={304} y={112} textAnchor="middle">
        y={y}
      </text>
    </svg>
  );
}
