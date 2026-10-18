export interface WaveSignal {
  name: string;
  kind: 'bit' | 'bus';
  values: number[];
  width?: number;
  tone?: 'clock' | 'data' | 'out';
}

const ROW = 26;
const LABEL_W = 64;

export function Waveform({
  signals,
  steps,
  stepWidth = 26,
  markers = [],
  label,
}: {
  signals: WaveSignal[];
  steps: number;
  stepWidth?: number;
  markers?: number[];
  label: string;
}) {
  const w = LABEL_W + steps * stepWidth + 8;
  const h = signals.length * ROW + 8;
  return (
    <svg className="wave" viewBox={`0 0 ${w} ${h}`} width={w} role="img" aria-label={label} preserveAspectRatio="xMinYMin meet">
      {markers.map((m) => (
        <line key={`m${m}`} className="wave-marker" x1={LABEL_W + m * stepWidth} x2={LABEL_W + m * stepWidth} y1={2} y2={h - 2} />
      ))}
      {signals.map((s, row) => {
        const y0 = row * ROW + 6;
        const hi = y0 + 2;
        const lo = y0 + ROW - 8;
        const mid = (hi + lo) / 2;
        const cls = `wave-sig ${s.tone ?? 'data'}`;
        let path = '';
        const segs: { x0: number; x1: number; v: number }[] = [];
        if (s.kind === 'bit') {
          s.values.forEach((v, i) => {
            const x0 = LABEL_W + i * stepWidth;
            const x1 = x0 + stepWidth;
            const y = v ? hi : lo;
            if (i === 0) path += `M${x0},${y}`;
            else if (v !== s.values[i - 1]) path += `L${x0},${y}`;
            path += `L${x1},${y}`;
          });
        } else {
          s.values.forEach((v, i) => {
            const x0 = LABEL_W + i * stepWidth;
            if (i > 0 && v === s.values[i - 1]) segs[segs.length - 1].x1 = x0 + stepWidth;
            else segs.push({ x0, x1: x0 + stepWidth, v });
          });
        }
        return (
          <g key={s.name} className={cls}>
            <text className="wave-name" x={0} y={mid + 4}>
              {s.name}
            </text>
            {s.kind === 'bit' ? (
              <path d={path} />
            ) : (
              segs.map((g, i) => (
                <g key={i}>
                  <path d={`M${g.x0 + 3},${hi} L${g.x1 - 3},${hi} L${g.x1},${mid} L${g.x1 - 3},${lo} L${g.x0 + 3},${lo} L${g.x0},${mid} Z`} />
                  {g.x1 - g.x0 >= 20 && (
                    <text className="wave-val" x={(g.x0 + g.x1) / 2} y={mid + 3.5} textAnchor="middle">
                      {g.v.toString(16).toUpperCase()}
                    </text>
                  )}
                </g>
              ))
            )}
          </g>
        );
      })}
    </svg>
  );
}
