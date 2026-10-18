import { Trace, traceExpression } from './expr/evaluate';
import { ArtParams, CompiledColorMap, CompiledPattern, DAC_LEVEL } from './pattern-generators';

export interface ChannelTrace {
  name: 'R' | 'G' | 'B';
  source: string;
  trace: Trace;
  level: number;
  intensity: number;
}

export interface PixelInspection {
  x: number;
  y: number;
  params: ArtParams;
  expression: string;
  trace: Trace;
  value: number;
  colorMap: CompiledColorMap;
  channels: ChannelTrace[];
  hex: string;
}

export function inspectPixel(
  pattern: CompiledPattern,
  colorMap: CompiledColorMap,
  x: number,
  y: number,
  params: ArtParams,
): PixelInspection {
  const trace = traceExpression(pattern.expr, { x, y, ...params });
  const v = trace.value;
  const channels = (['R', 'G', 'B'] as const).map((name) => {
    const expr = name === 'R' ? colorMap.r : name === 'G' ? colorMap.g : colorMap.b;
    const t = traceExpression(expr, { v });
    return { name, source: expr.source, trace: t, level: t.value, intensity: t.value * DAC_LEVEL };
  });
  const hex =
    '#' +
    channels
      .map((c) => c.intensity.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  return { x, y, params, expression: pattern.expr.source, trace, value: v, colorMap, channels, hex };
}
