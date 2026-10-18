import { VGA_640x480, VgaTiming } from './tinyvga';

export interface InputField {
  id: string;
  label: string;
  msb: number;
  lsb: number;
  kind: 'select' | 'range' | 'toggle';
  options?: { value: number; label: string }[];
  hint?: string;
}

export interface HardwareManifest {
  name: string;
  topModule?: string;
  inputs: InputField[];
  timing: VgaTiming;
  resetCycles: number;
}

export const hardwareManifest: HardwareManifest = {
  name: 'BITFIELD demoscene (real Verilog)',
  topModule: 'tt_um_omrawaley_bitfield',
  inputs: [
    {
      id: 'manual',
      label: 'Manual mode',
      kind: 'toggle',
      msb: 4,
      lsb: 4,
      hint: 'Off: the chip runs its autonomous gallery — a new pattern about once per second. On: the controls below steer it.',
    },
    {
      id: 'pattern',
      label: 'Pattern',
      kind: 'select',
      msb: 7,
      lsb: 5,
      hint: 'Used when Manual mode is on.',
      options: [
        { value: 0, label: '0 · XOR lattice' },
        { value: 1, label: '1 · Moiré rings' },
        { value: 2, label: '2 · Hyperbola field' },
        { value: 3, label: '3 · Ring interference' },
        { value: 4, label: '4 · Sierpinski sieve' },
        { value: 5, label: '5 · Diagonal weave' },
        { value: 6, label: '6 · Tartan' },
      ],
    },
    {
      id: 'palette',
      label: 'Palette',
      kind: 'select',
      msb: 3,
      lsb: 2,
      hint: 'Used when Manual mode is on.',
      options: [
        { value: 0, label: 'Direct' },
        { value: 1, label: 'High bits' },
        { value: 2, label: 'Split' },
        { value: 3, label: 'Inverted' },
      ],
    },
    {
      id: 'shift',
      label: 'Shift amount',
      kind: 'range',
      msb: 1,
      lsb: 0,
      hint: 'Used when Manual mode is on. Shifts/zooms the bitwise patterns.',
    },
  ],
  // The playground default capture offsets assume a registered hvsync
  // generator; this design drives the syncs combinationally, so x is +1.
  timing: { ...VGA_640x480, captureOffsetX: 48, captureOffsetY: 32 },
  resetCycles: 10,
};

export const hardwareSources: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../../src/*.{v,sv,vh,svh}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  ).map(([path, src]) => [path.split('/').pop()!, src]),
);
