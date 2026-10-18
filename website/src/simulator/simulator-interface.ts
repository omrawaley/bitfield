import type { PixelInspection } from '../math/pixel-inspector';

export type SimulatorKind = 'browser-demo' | 'verilog';

export type ControlBinding =
  | { type: 'demo-param' }
  | { type: 'ui_in'; msb: number; lsb: number };

interface ControlBase {
  id: string;
  label: string;
  hint?: string;
  binding: ControlBinding;
}

export interface SelectControl extends ControlBase {
  kind: 'select';
  options: { value: number; label: string }[];
}

export interface RangeControl extends ControlBase {
  kind: 'range';
  min: number;
  max: number;
  bits?: number;
}

export interface ToggleControl extends ControlBase {
  kind: 'toggle';
}

export type ControlDescriptor = SelectControl | RangeControl | ToggleControl;

export interface SimulatorCapabilities {
  restart: boolean;
  speed: boolean;
  pixelProbe: 'expression' | 'pins' | 'none';
}

export interface SimulatorInfo {
  kind: SimulatorKind;
  title: string;
  isHardwareModel: boolean;
  disclosure: string;
  width: number;
  height: number;
  format: string;
}

export interface FrameResult {
  frame: number;
  t?: number;
}

export type PixelProbe =
  | { kind: 'expression'; inspection: PixelInspection }
  | {
      kind: 'pins';
      x: number;
      y: number;
      uoOut: number;
      rgb: [number, number, number];
    };

export class SimulatorUnavailableError extends Error {
  constructor(
    message: string,
    public readonly checklist: string[] = [],
  ) {
    super(message);
    this.name = 'SimulatorUnavailableError';
  }
}

export interface ArtSimulator {
  readonly info: SimulatorInfo;
  readonly capabilities: SimulatorCapabilities;
  getControls(): ControlDescriptor[];
  getControl(id: string): number;
  setControl(id: string, value: number): void;
  load(): Promise<void>;
  reset(): void;
  setSpeed(multiplier: number): void;
  renderFrame(out: Uint32Array, advance: boolean): FrameResult;
  probe(x: number, y: number): PixelProbe | null;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
