# Connecting the real Verilog design

The art viewer has two pixel sources. Each is labelled on screen:

| Source | What it is | Status |
|---|---|---|
| **Reference demo** | Our demo formulas evaluated in JavaScript with Verilog width rules | works now |
| **Verilog sim** | Our design simulated cycle by cycle; pixels decoded from `uo_out` | works now (vendored Verilator-WASM) |

If the Verilog simulation cannot run, the viewer shows the reason. It never falls back to the demo on its own.

## 1. Where the sources come from

There is no copy to maintain: `src/simulator/hardware-manifest.ts` loads
`*.v`, `*.sv`, `*.vh` and `*.svh` straight from the repo-root `src/` folder —
the same files the Tiny Tapeout flow hardens. Add a file there and restart
the dev server. The top module is the first `module tt_um_*` found, or set
`topModule` in `src/simulator/hardware-manifest.ts`.

The design must use the TinyVGA PMOD pinout:

```verilog
assign uo_out = {hsync, B[0], G[0], R[0], vsync, B[1], G[1], R[1]};
```

## 2. Describe the inputs (optional)

In `src/simulator/hardware-manifest.ts`, list what each `ui_in` bit field does. The viewer builds its controls only from this list:

```ts
inputs: [
  { id: 'pattern', label: 'Pattern', msb: 2, lsb: 0, kind: 'select',
    options: [{ value: 0, label: 'XOR' }, { value: 1, label: 'RINGS' }] },
  { id: 'shift', label: 'Shift', msb: 5, lsb: 3, kind: 'range' },
],
```

If the list is empty, the viewer shows the eight raw `ui_in[n]` switches. Controls the hardware does not have, such as speed, are hidden.

## 3. Register a simulation backend

The adapter (`src/simulator/verilog-adapter.ts`) needs something that compiles Verilog into a model with the `HdlModule` interface: `state`, `data8`, `globals.lookup()`, `powercycle()`, `tick2()`, `dispose()`.

The **Tiny Tapeout VGA Playground** simulator provides exactly this: Verilator compiled to WASM, plus 8bitworkshop's `hdlwasm`.

> **License:** that code is **GPL-3.0**. Copying it into this project makes the website a GPL-3.0 derivative work, which is fine for an open-source hackathon project. Decide as a team before vendoring it.

Steps:

```sh
git clone https://github.com/TinyTapeout/vga-playground /tmp/vga-playground
mkdir -p src/vendor/vga-playground
cp -r /tmp/vga-playground/src/sim /tmp/vga-playground/src/verilator src/vendor/vga-playground/
cp /tmp/vga-playground/LICENSE src/vendor/vga-playground/
npm install binaryen@117
```

Then make `src/simulator/backend.ts` register the backend:

```ts
import { registerHdlBackend } from './verilog-adapter';

registerHdlBackend({
  name: 'Verilator (WASM) + hdlwasm',
  license: 'GPL-3.0',
  async create(sources, topModule) {
    const { compileVerilator } = await import('../vendor/vga-playground/verilator/compile');
    const { HDLModuleWASM } = await import('../vendor/vga-playground/sim/hdlwasm');
    const res = await compileVerilator({ topModule, sources });
    if (!res.output) throw new Error(res.errors.map((e) => `${e.file}:${e.line} ${e.message}`).join('\n'));
    const pool = res.output.modules['@CONST-POOL@'] || res.output.modules['__Vconst'];
    const mod = new HDLModuleWASM(res.output.modules['TOP'], pool);
    await mod.init();
    return mod;
  },
});
```

The dynamic imports keep Verilator and binaryen out of the initial bundle. This wrapper was tested against the playground's `stripes` example, and the adapter reproduced every pixel of two consecutive frames.

Notes:

- The Verilator WASM binary (about 6 MB) and binaryen are loaded through dynamic imports, so they download only when "Verilog sim" is selected.
- If the picture is shifted by a pixel or a line, adjust `captureOffsetX` / `captureOffsetY` in the manifest timing. The defaults (47 clocks / 32 lines after the sync pulses end) match `hvsync_generator.v`, whose sync outputs are registered.
- Run `npm test` after changes. `src/simulator/verilog-adapter.test.ts` checks the capture logic against a cycle-accurate model of the sync generator.
