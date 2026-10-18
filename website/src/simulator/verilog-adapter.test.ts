import { describe, expect, it } from 'vitest';
import { DAC_LEVEL, packRGBA } from '../math/pattern-generators';
import { VGA_640x480, decodeTinyVGA, encodeTinyVGA } from './tinyvga';
import { HdlBackend, HdlModule, VerilogSimulator } from './verilog-adapter';
import { SimulatorUnavailableError } from './simulator-interface';

function fakeModule(colour: (x: number, y: number, ui: number) => [number, number, number]): HdlModule {
  const H_MAX = 799, V_MAX = 524;
  let hpos = 0, vpos = 0, hsync = 1, vsync = 1;
  const data8 = new Uint8Array(1);
  const state: Record<string, number> = { ui_in: 0, rst_n: 1, ena: 1 };
  const update = () => {
    const on = hpos < 640 && vpos < 480;
    const [r, g, b] = on ? colour(hpos, vpos, state.ui_in) : [0, 0, 0];
    data8[0] = encodeTinyVGA({ hsync, vsync, r, g, b });
  };
  return {
    state,
    data8,
    globals: { lookup: () => ({ offset: 0 }) },
    powercycle() {
      hpos = vpos = 0;
      hsync = vsync = 1;
      update();
    },
    tick2(n: number) {
      for (let i = 0; i < n; i++) {
        const reset = !state.rst_n;
        const hmax = hpos === H_MAX || reset;
        const vmax = vpos === V_MAX || reset;
        const nh = hpos >= 656 && hpos <= 751 ? 0 : 1;
        const nv = vpos >= 490 && vpos <= 491 ? 0 : 1;
        const nhpos = hmax ? 0 : hpos + 1;
        const nvpos = hmax ? (vmax ? 0 : vpos + 1) : vpos;
        hsync = nh;
        vsync = nv;
        hpos = nhpos;
        vpos = nvpos;
      }
      update();
    },
    dispose() {},
  };
}

const stripes = (x: number, y: number, ui: number): [number, number, number] => [
  ((x >> 5) & 1) * 2 + ((y >> 2) & 1),
  ((x >> 6) & 1) * 2 + (ui & 1),
  (x ^ y) & 3,
];

const backend: HdlBackend = {
  name: 'test model',
  license: 'n/a',
  create: async () => fakeModule(stripes),
};

const manifest = { name: 'test', inputs: [], timing: VGA_640x480, resetCycles: 10 };

describe('TinyVGA decoding', () => {
  it('round-trips every pin combination', () => {
    for (let uo = 0; uo < 256; uo++) expect(encodeTinyVGA(decodeTinyVGA(uo))).toBe(uo);
  });
});

describe('VerilogSimulator', () => {
  it('reports missing sources instead of falling back', async () => {
    const sim = new VerilogSimulator(manifest, {}, backend);
    await expect(sim.load()).rejects.toBeInstanceOf(SimulatorUnavailableError);
  });

  it('reports a missing backend', async () => {
    const sim = new VerilogSimulator(manifest, { 'project.v': 'module tt_um_x(); endmodule' });
    await expect(sim.load()).rejects.toThrow(/no HDL simulation backend/);
  });

  it('captures pixels at exactly the right coordinates', async () => {
    const sim = new VerilogSimulator(manifest, { 'project.v': 'module tt_um_test(); endmodule' }, backend);
    await sim.load();
    sim.setControl('ui_in_0', 1);
    const out = new Uint32Array(640 * 480);
    sim.renderFrame(out, true);
    for (const [x, y] of [[0, 0], [1, 0], [639, 0], [0, 479], [639, 479], [123, 321], [64, 4]]) {
      const [r, g, b] = stripes(x, y, 1);
      expect(out[y * 640 + x], `pixel ${x},${y}`).toBe(packRGBA(r * DAC_LEVEL, g * DAC_LEVEL, b * DAC_LEVEL));
    }
    const probe = sim.probe(64, 4);
    expect(probe?.kind).toBe('pins');
    if (probe?.kind === 'pins') expect(probe.rgb).toEqual(stripes(64, 4, 1));
  });

  it('derives raw ui_in controls when no pin map exists', () => {
    const sim = new VerilogSimulator(manifest, {}, backend);
    expect(sim.getControls().map((c) => c.label)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => `ui_in[${i}]`));
  });
});
