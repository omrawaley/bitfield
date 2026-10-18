const XOR_CELL = 'sky130_fd_sc_hd__xor2_1';

function MathVisual() {
  const cells = [];
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const v = x ^ y;
      cells.push(
        <g key={`${x}${y}`}>
          <rect x={226 + x * 34} y={30 + y * 34} width={33} height={33} className={`sv-v${v}`} />
          <text x={226 + x * 34 + 16.5} y={30 + y * 34 + 21} textAnchor="middle" className="sv-cell-txt">
            {v}
          </text>
        </g>,
      );
    }
  return (
    <>
      <text x={10} y={88} className="sv-big new">
        v = x ⊕ y
      </text>
      <text x={10} y={112} className="sv-small">
        x, y, v ∈ {'{0,1,2,3}'}
      </text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <text x={226 + i * 34 + 16.5} y={24} textAnchor="middle" className="sv-small">
            x={i}
          </text>
          <text x={220} y={30 + i * 34 + 21} textAnchor="end" className="sv-small">
            y={i}
          </text>
        </g>
      ))}
      {cells}
    </>
  );
}

function RtlVisual() {
  const lines = ['module xor2b (', '  input  wire [1:0] x,', '  input  wire [1:0] y,', '  output wire [1:0] v', ');', '  assign v = x ^ y;', 'endmodule'];
  return (
    <>
      {lines.map((l, i) => (
        <text key={i} x={30} y={40 + i * 22} className={`sv-code ${i === 5 ? 'new' : ''}`}>
          {l}
        </text>
      ))}
    </>
  );
}

function GateSym({ x, y, label, isNew }: { x: number; y: number; label: string; isNew: boolean }) {
  return (
    <g transform={`translate(${x},${y})`} className={isNew ? 'new' : ''}>
      <path className="sv-gate-line" d="M-6,0 Q8,20 -6,40" />
      <path className="sv-gate" d="M0,0 Q36,0 56,20 Q36,40 0,40 Q14,20 0,0 Z" />
      <text x={20} y={58} textAnchor="middle" className="sv-tiny">
        {label}
      </text>
    </g>
  );
}

function SynthVisual() {
  return (
    <>
      {[0, 1].map((b) => {
        const y = 30 + b * 90;
        return (
          <g key={b}>
            <text x={30} y={y + 12} className="sv-small">x[{b}]</text>
            <text x={30} y={y + 34} className="sv-small">y[{b}]</text>
            <line className="sv-net" x1={70} y1={y + 8} x2={182} y2={y + 8} />
            <line className="sv-net" x1={70} y1={y + 30} x2={182} y2={y + 30} />
            <GateSym x={180} y={y - 1} label={`U${b + 1}: ${XOR_CELL}`} isNew />
            <line className="sv-net" x1={236} y1={y + 19} x2={330} y2={y + 19} />
            <text x={338} y={y + 23} className="sv-small">v[{b}]</text>
          </g>
        );
      })}
    </>
  );
}

const ROUTES = (RX: number, RY: number, RH: number): [number, number][][] => [
  [[RX - 10, 40], [RX + 50, 40], [RX + 50, RY + RH + 12], [RX + 70, RY + RH + 12]],
  [[RX - 10, 76], [RX + 40, 76], [RX + 40, RY + RH + 24], [RX + 70, RY + RH + 24]],
  [[RX + 126, RY + RH + 18], [RX + 250, RY + RH + 18], [RX + 250, 70], [RX + 310, 70]],
  [[RX - 10, 112], [RX + 150, 112], [RX + 150, RY + 2 * RH + 12], [RX + 180, RY + 2 * RH + 12]],
  [[RX - 10, 148], [RX + 165, 148], [RX + 165, RY + 2 * RH + 24], [RX + 180, RY + 2 * RH + 24]],
  [[RX + 236, RY + 2 * RH + 18], [RX + 280, RY + 2 * RH + 18], [RX + 280, 130], [RX + 310, 130]],
];

function Floorplan({ stage }: { stage: 'place' | 'route' }) {
  const rows = [0, 1, 2, 3];
  const RX = 60,
    RW = 300,
    RH = 36,
    RY = 22;
  return (
    <>
      <rect x={RX - 14} y={RY - 12} width={RW + 28} height={rows.length * RH + 24} className="sv-die" />
      {rows.map((r) => (
        <g key={r}>
          <rect x={RX} y={RY + r * RH} width={RW} height={RH} className="sv-row" />
          <line x1={RX} x2={RX + RW} y1={RY + r * RH} y2={RY + r * RH} className={r % 2 ? 'sv-vgnd' : 'sv-vpwr'} />
        </g>
      ))}
      <line x1={RX} x2={RX + RW} y1={RY + rows.length * RH} y2={RY + rows.length * RH} className="sv-vpwr" />
      {[
        [0, 0], [0, 270], [1, 0], [1, 270], [2, 0], [2, 270], [3, 0], [3, 270],
        [1, 150], [2, 40], [0, 120], [3, 200],
      ].map(([r, x], i) => (
        <rect key={i} x={RX + x + 2} y={RY + r * RH + 4} width={26} height={RH - 8} className="sv-fill" />
      ))}
      <g className={stage === 'place' ? 'new' : ''}>
        <rect x={RX + 70} y={RY + 1 * RH + 4} width={56} height={RH - 8} className="sv-cell" />
        <text x={RX + 98} y={RY + 1 * RH + 22} textAnchor="middle" className="sv-tiny">U1 xor2</text>
        <rect x={RX + 180} y={RY + 2 * RH + 4} width={56} height={RH - 8} className="sv-cell" />
        <text x={RX + 208} y={RY + 2 * RH + 22} textAnchor="middle" className="sv-tiny">U2 xor2</text>
      </g>
      {[['x[0]', 40], ['y[0]', 76], ['x[1]', 112], ['y[1]', 148]].map(([n, y]) => (
        <g key={n as string}>
          <rect x={RX - 18} y={(y as number) - 3} width={8} height={6} className="sv-pin" />
          <text x={RX - 22} y={(y as number) + 3} textAnchor="end" className="sv-tiny">{n}</text>
        </g>
      ))}
      {[['v[0]', 70], ['v[1]', 130]].map(([n, y]) => (
        <g key={n as string}>
          <rect x={RX + RW + 10} y={(y as number) - 3} width={8} height={6} className="sv-pin" />
          <text x={RX + RW + 22} y={(y as number) + 3} className="sv-tiny">{n}</text>
        </g>
      ))}
      {stage === 'route' && (
        <g className="new">
          {ROUTES(RX, RY, RH).map((pts, n) => (
            <g key={n}>
              {pts.slice(1).map(([x, y], i) => {
                const [px, py] = pts[i];
                return <line key={i} x1={px} y1={py} x2={x} y2={y} className={py === y ? 'sv-m1' : 'sv-m2'} />;
              })}
              {pts.slice(1, -1).map(([x, y], i) => (
                <rect key={`v${i}`} x={x - 3} y={y - 3} width={6} height={6} className="sv-via" />
              ))}
            </g>
          ))}
        </g>
      )}
    </>
  );
}

function LayoutVisual() {
  const layers = [
    { name: 'met2', cls: 'sv-l-m2' },
    { name: 'met1', cls: 'sv-l-m1' },
    { name: 'li1', cls: 'sv-l-li' },
    { name: 'poly', cls: 'sv-l-poly' },
    { name: 'diff', cls: 'sv-l-diff' },
  ];
  const iso = (x: number, y: number, z: number) => [200 + (x - y) * 0.86, 40 + (x + y) * 0.5 - z];
  const quad = (z: number) =>
    [iso(0, 0, z), iso(160, 0, z), iso(160, 120, z), iso(0, 120, z)].map((p) => p.join(',')).join(' ');
  return (
    <>
      {layers.map((l, i) => {
        const z = (layers.length - 1 - i) * 26 - 70;
        return (
          <g key={l.name} className="new">
            <polygon points={quad(z)} className={`sv-plane ${l.cls}`} />
            <text x={iso(160, 0, z)[0] + 10} y={iso(160, 0, z)[1] + 4} className="sv-tiny">
              {l.name}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function StageVisual({ id }: { id: string }) {
  let body;
  switch (id) {
    case 'math':
      body = <MathVisual />;
      break;
    case 'rtl':
      body = <RtlVisual />;
      break;
    case 'synth':
      body = <SynthVisual />;
      break;
    case 'place':
      body = <Floorplan stage="place" />;
      break;
    case 'route':
      body = <Floorplan stage="route" />;
      break;
    default:
      body = <LayoutVisual />;
  }
  return (
    <figure className="stage-visual">
      <svg viewBox="0 0 420 190" role="img" aria-label={`Schematic illustration of the ${id} stage for a 2-bit XOR`}>
        {body}
      </svg>
      <figcaption>
        <span className="badge muted">Illustration</span> a 2-bit <code>v = x ^ y</code> example, not our design. New at this stage: <span className="new-key">highlighted</span>.
        {id === 'route' && (
          <span className="sv-legend">
            <i className="m1" /> met1 <i className="m2" /> met2 <i className="via" /> via
          </span>
        )}
      </figcaption>
    </figure>
  );
}
