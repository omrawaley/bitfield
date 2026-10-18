/**
 * End-to-end check of the hardware simulator: compiles the real design
 * (src/project.v at the repo root, the file Tiny Tapeout hardens) with the
 * vendored Verilator-WASM and renders frames through the same
 * VerilogSimulator used by the site.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { compileVerilator } from '../vendor/vga-playground/verilator/compile';
import { HDLModuleWASM } from '../vendor/vga-playground/sim/hdlwasm';
import { VerilogSimulator, type HdlBackend, type HdlModule } from './verilog-adapter';
import { hardwareManifest, hardwareSources } from './hardware-manifest';

const wasmBinary = readFileSync(new URL('../vendor/vga-playground/verilator/verilator_bin.wasm', import.meta.url));

const nodeBackend: HdlBackend = {
  name: 'Verilator-WASM (node test)',
  license: 'ISC · GPL-3.0',
  async create(sources, topModule) {
    const res = await compileVerilator({ topModule, sources, wasmBinary });
    if (!res.output) throw new Error(res.errors.map((e) => e.message).join('\n'));
    const constpool = res.output.modules['@CONST-POOL@'] || res.output.modules['__Vconst'] || null;
    const mod = new HDLModuleWASM(res.output.modules['TOP'], constpool);
    await mod.init();
    return mod as unknown as HdlModule;
  },
};

// Verilator's WASM build can call process.exit; keep it from killing vitest.
const origExit = process.exit;
beforeAll(() => {
  process.exit = vi.fn((code?: number) => {
    throw new Error(`process.exit called with ${code}`);
  }) as never;
});
afterAll(() => {
  process.exit = origExit;
});

function stats(u: Uint32Array) {
  const colors = new Set<number>();
  let nonBlack = 0;
  for (const v of u) {
    colors.add(v);
    if ((v & 0xffffff) !== 0) nonBlack++;
  }
  return { colors: colors.size, nonBlack };
}

function diff(a: Uint32Array, b: Uint32Array) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

it('renders the real Verilog design through the site simulator', async () => {
  const sim = new VerilogSimulator(hardwareManifest, hardwareSources, nodeBackend);
  await sim.load();

  const out = new Uint32Array(640 * 480);
  const frames: Uint32Array[] = [];

  sim.renderFrame(out, true);
  frames.push(Uint32Array.from(out));

  // ~2 seconds later the LFSR has re-rolled the show at least twice
  for (let i = 0; i < 130; i++) sim.renderFrame(out, true);
  frames.push(Uint32Array.from(out));

  sim.setControl('manual', 1);
  sim.setControl('pattern', 3);
  sim.setControl('palette', 0);
  sim.setControl('shift', 1);
  sim.renderFrame(out, true);
  sim.renderFrame(out, true);
  frames.push(Uint32Array.from(out));
  sim.dispose();

  expect(stats(frames[0]).nonBlack).toBeGreaterThan(50_000);
  expect(stats(frames[0]).colors).toBeGreaterThan(8);
  expect(diff(frames[0], frames[1])).toBeGreaterThan(10_000);
  expect(diff(frames[1], frames[2])).toBeGreaterThan(10_000);
}, 120_000);
