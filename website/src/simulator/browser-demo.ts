import { inspectPixel } from '../math/pixel-inspector';
import {
  COLOR_MAPS,
  CompiledPattern,
  DEMO_PATTERNS,
  getColorMap,
  getPattern,
} from '../math/pattern-generators';
import type {
  ArtSimulator,
  ControlDescriptor,
  FrameResult,
  PixelProbe,
  SimulatorCapabilities,
  SimulatorInfo,
} from './simulator-interface';

export const VGA_WIDTH = 640;
export const VGA_HEIGHT = 480;

export class BrowserDemoSimulator implements ArtSimulator {
  readonly info: SimulatorInfo = {
    kind: 'browser-demo',
    title: 'Browser reference demo',
    isHardwareModel: false,
    disclosure:
      'Reference demo. Formulas are evaluated in JavaScript with Verilog unsigned width rules. This is not the output of our Verilog design.',
    width: VGA_WIDTH,
    height: VGA_HEIGHT,
    format: 'RGB222 · 64 colours',
  };

  readonly capabilities: SimulatorCapabilities = {
    restart: true,
    speed: true,
    pixelProbe: 'expression',
  };

  private values: Record<string, number> = {
    pattern: 0,
    s: DEMO_PATTERNS[0].defaults.s,
    k: DEMO_PATTERNS[0].defaults.k,
    map: Math.max(0, COLOR_MAPS.findIndex((c) => c.id === DEMO_PATTERNS[0].defaults.map)),
  };
  private frame = 0;
  private timeAcc = 0;
  private speed = 1;
  private listeners = new Set<() => void>();

  async load(): Promise<void> {
    DEMO_PATTERNS.forEach(getPattern);
    COLOR_MAPS.forEach((c) => getColorMap(c.id));
  }

  get pattern(): CompiledPattern {
    return getPattern(DEMO_PATTERNS[this.values.pattern] ?? DEMO_PATTERNS[0]);
  }

  get colorMap() {
    return getColorMap(COLOR_MAPS[this.values.map]?.id ?? COLOR_MAPS[0].id);
  }

  get t(): number {
    return Math.floor(this.timeAcc) & 0xff;
  }

  getControls(): ControlDescriptor[] {
    const uses = this.pattern.expr.identifiers;
    const controls: ControlDescriptor[] = [
      {
        kind: 'select',
        id: 'pattern',
        label: 'Pattern',
        binding: { type: 'demo-param' },
        options: DEMO_PATTERNS.map((p, i) => ({ value: i, label: p.name })),
      },
    ];
    if (uses.has('s')) {
      controls.push({ kind: 'range', id: 's', label: 'Shift s', min: 0, max: 7, bits: 3, binding: { type: 'demo-param' }, hint: 'Bit-shift amount' });
    }
    if (uses.has('k')) {
      controls.push({ kind: 'range', id: 'k', label: 'Constant k', min: 0, max: 255, bits: 8, binding: { type: 'demo-param' }, hint: '8-bit constant' });
    }
    controls.push({
      kind: 'select',
      id: 'map',
      label: 'Colour map',
      binding: { type: 'demo-param' },
      options: COLOR_MAPS.map((c, i) => ({ value: i, label: c.name })),
    });
    return controls;
  }

  getControl(id: string): number {
    return this.values[id] ?? 0;
  }

  setControl(id: string, value: number): void {
    if (this.values[id] === value) return;
    this.values[id] = value;
    if (id === 'pattern') {
      const def = DEMO_PATTERNS[value];
      if (def) {
        this.values.s = def.defaults.s;
        this.values.k = def.defaults.k;
        this.values.map = Math.max(0, COLOR_MAPS.findIndex((c) => c.id === def.defaults.map));
      }
    }
    this.emit();
  }

  reset(): void {
    this.frame = 0;
    this.timeAcc = 0;
    this.emit();
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  renderFrame(out: Uint32Array, advance: boolean): FrameResult {
    if (advance) {
      this.frame++;
      this.timeAcc = (this.timeAcc + this.speed) % 256;
    }
    this.pattern.render(out, VGA_WIDTH, VGA_HEIGHT, 0, 0, this.params(), this.colorMap.lut);
    return { frame: this.frame, t: this.t };
  }

  params() {
    return { t: this.t, s: this.values.s, k: this.values.k };
  }

  probe(x: number, y: number): PixelProbe | null {
    if (x < 0 || y < 0 || x >= VGA_WIDTH || y >= VGA_HEIGHT) return null;
    return { kind: 'expression', inspection: inspectPixel(this.pattern, this.colorMap, x, y, this.params()) };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  dispose(): void {
    this.listeners.clear();
  }
}
