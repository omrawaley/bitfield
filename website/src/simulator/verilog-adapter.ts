import { HardwareManifest, hardwareManifest, hardwareSources } from './hardware-manifest';
import type {
  ArtSimulator,
  ControlDescriptor,
  FrameResult,
  PixelProbe,
  SimulatorCapabilities,
  SimulatorInfo,
} from './simulator-interface';
import { SimulatorUnavailableError } from './simulator-interface';
import { decodeTinyVGA } from './tinyvga';
import { packRGBA, DAC_LEVEL } from '../math/pattern-generators';

export interface HdlModule {
  state: Record<string, number>;
  readonly data8: Uint8Array;
  globals: { lookup(name: string): { offset: number } };
  powercycle(): void;
  tick2(cycles: number): void;
  dispose(): void;
}

export interface HdlBackend {
  name: string;
  license: string;
  create(sources: Record<string, string>, topModule: string): Promise<HdlModule>;
}

let backend: HdlBackend | null = null;

export function registerHdlBackend(b: HdlBackend): void {
  backend = b;
}

export function detectTopModule(sources: Record<string, string>): string | null {
  for (const src of Object.values(sources)) {
    const clean = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = clean.match(/^\s*module\s+(tt_um_\w+)/m);
    if (m) return m[1];
  }
  return null;
}

export class VgaSyncError extends Error {}

export class VerilogSimulator implements ArtSimulator {
  readonly info: SimulatorInfo;
  readonly capabilities: SimulatorCapabilities = { restart: true, speed: false, pixelProbe: 'pins' };

  private mod: HdlModule | null = null;
  private uoOffset = 0;
  private hInvert = 0;
  private vInvert = 0;
  private uiIn = 0;
  private frame = 0;
  private lastFrame: Uint32Array;
  private pins: Uint8Array;
  private listeners = new Set<() => void>();

  constructor(
    private readonly manifest: HardwareManifest = hardwareManifest,
    private readonly sources: Record<string, string> = hardwareSources,
    private readonly backendOverride?: HdlBackend,
  ) {
    const { hVisible, vVisible } = manifest.timing;
    this.info = {
      kind: 'verilog',
      title: manifest.name,
      isHardwareModel: true,
      disclosure:
        'Cycle-level simulation of our Verilog. Each pixel is decoded from the TinyVGA pins on uo_out.',
      width: hVisible,
      height: vVisible,
      format: 'RGB222 · from uo_out',
    };
    this.lastFrame = new Uint32Array(hVisible * vVisible);
    this.pins = new Uint8Array(hVisible * vVisible);
  }

  async load(): Promise<void> {
    const files = Object.keys(this.sources);
    if (files.length === 0) {
      throw new SimulatorUnavailableError('No Verilog sources found.', [
        'The design sources are loaded from the repo-root src/ folder (for example project.v).',
        'Restart the dev server so Vite picks up the new files.',
      ]);
    }
    const b = this.backendOverride ?? backend;
    if (!b) {
      throw new SimulatorUnavailableError(`Found ${files.length} source file(s), but no HDL simulation backend is registered.`, [
        'Follow hardware/README.md to add the Verilator-WASM backend.',
        'Register it in src/simulator/backend.ts (the tested snippet is in hardware/README.md).',
      ]);
    }
    const top = this.manifest.topModule ?? detectTopModule(this.sources);
    if (!top) {
      throw new SimulatorUnavailableError('Could not find a top module named tt_um_*.', [
        'Set topModule in src/simulator/hardware-manifest.ts.',
      ]);
    }
    try {
      this.mod = await b.create(this.sources, top);
    } catch (e) {
      throw new SimulatorUnavailableError(`The ${b.name} backend failed to build ${top}: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.uoOffset = this.mod.globals.lookup('uo_out').offset;
    this.reset();
    this.hInvert = this.detectActiveLow(7) ? 1 : 0;
    this.vInvert = this.detectActiveLow(3) ? 1 : 0;
    this.reset();
  }

  getControls(): ControlDescriptor[] {
    if (this.manifest.inputs.length > 0) {
      return this.manifest.inputs.map((f): ControlDescriptor => {
        const binding = { type: 'ui_in' as const, msb: f.msb, lsb: f.lsb };
        const width = f.msb - f.lsb + 1;
        if (f.kind === 'select') {
          return {
            kind: 'select',
            id: f.id,
            label: f.label,
            hint: f.hint,
            binding,
            options: f.options ?? Array.from({ length: 2 ** width }, (_, i) => ({ value: i, label: String(i) })),
          };
        }
        if (f.kind === 'toggle') return { kind: 'toggle', id: f.id, label: f.label, hint: f.hint, binding };
        return { kind: 'range', id: f.id, label: f.label, hint: f.hint, binding, min: 0, max: 2 ** width - 1, bits: width };
      });
    }
    return Array.from({ length: 8 }, (_, i) => ({
      kind: 'toggle' as const,
      id: `ui_in_${i}`,
      label: `ui_in[${i}]`,
      binding: { type: 'ui_in' as const, msb: i, lsb: i },
    }));
  }

  private fieldFor(id: string) {
    const c = this.getControls().find((c) => c.id === id);
    return c && c.binding.type === 'ui_in' ? c.binding : null;
  }

  getControl(id: string): number {
    const f = this.fieldFor(id);
    if (!f) return 0;
    return (this.uiIn >> f.lsb) & ((1 << (f.msb - f.lsb + 1)) - 1);
  }

  setControl(id: string, value: number): void {
    const f = this.fieldFor(id);
    if (!f) return;
    const m = ((1 << (f.msb - f.lsb + 1)) - 1) << f.lsb;
    this.uiIn = (this.uiIn & ~m) | ((value << f.lsb) & m);
    if (this.mod) this.mod.state.ui_in = this.uiIn;
    this.listeners.forEach((l) => l());
  }

  reset(): void {
    const mod = this.mod;
    if (!mod) return;
    mod.powercycle();
    mod.state.ena = 1;
    mod.state.ui_in = this.uiIn;
    mod.state.rst_n = 0;
    mod.tick2(this.manifest.resetCycles);
    mod.state.rst_n = 1;
    this.frame = 0;
  }

  setSpeed(): void {
  }

  private detectActiveLow(bit: number): boolean {
    const mod = this.mod!;
    const read = () => (mod.data8[this.uoOffset] >> bit) & 1;
    const limit = this.manifest.timing.hTotal * this.manifest.timing.vTotal * 2;
    const run = (level: number) => {
      let n = 0;
      while (read() === level && n < limit) {
        mod.tick2(1);
        n++;
      }
      if (n >= limit) throw new VgaSyncError(`uo_out[${bit}] never toggles. Is the ${bit === 7 ? 'hsync' : 'vsync'} pin connected?`);
      return n;
    };
    run(read());
    const levelA = read();
    const a = run(levelA);
    const b = run(1 - levelA);
    const pulseLevel = a < b ? levelA : 1 - levelA;
    return pulseLevel === 0;
  }

  renderFrame(out: Uint32Array, advance: boolean): FrameResult {
    if (!this.mod) throw new SimulatorUnavailableError('Verilog simulation is not loaded.');
    if (advance) {
      this.captureFrame(this.lastFrame);
      this.frame++;
    }
    out.set(this.lastFrame);
    return { frame: this.frame };
  }

  private captureFrame(out: Uint32Array) {
    const mod = this.mod!;
    const T = this.manifest.timing;
    const off = this.uoOffset;
    const budget = T.hTotal * T.vTotal * 3;
    let cycles = 0;
    const tick = () => {
      mod.tick2(1);
      if (++cycles > budget) throw new VgaSyncError('No complete VGA frame within 3 frame periods. Check the hsync/vsync timing.');
    };
    const hs = () => ((mod.data8[off] >> 7) & 1) ^ this.hInvert;
    const vs = () => ((mod.data8[off] >> 3) & 1) ^ this.vInvert;

    while (!vs()) tick();
    while (vs()) tick();
    for (let line = 0; line < T.captureOffsetY + T.vVisible; line++) {
      while (!hs()) tick();
      while (hs()) tick();
      if (line < T.captureOffsetY) continue;
      for (let i = 0; i < T.captureOffsetX; i++) tick();
      let p = (line - T.captureOffsetY) * T.hVisible;
      for (let x = 0; x < T.hVisible; x++, p++) {
        const uo = mod.data8[off];
        const { r, g, b } = decodeTinyVGA(uo);
        this.pins[p] = uo;
        out[p] = packRGBA(r * DAC_LEVEL, g * DAC_LEVEL, b * DAC_LEVEL);
        tick();
      }
    }
  }

  probe(x: number, y: number): PixelProbe | null {
    const { hVisible, vVisible } = this.manifest.timing;
    if (!this.mod || x < 0 || y < 0 || x >= hVisible || y >= vVisible) return null;
    const uo = this.pins[y * hVisible + x];
    const { r, g, b } = decodeTinyVGA(uo);
    return { kind: 'pins', x, y, uoOut: uo, rgb: [r, g, b] };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.mod?.dispose();
    this.mod = null;
    this.listeners.clear();
  }
}
