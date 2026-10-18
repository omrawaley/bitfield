# BITFIELD — mathematical art in silicon

Interactive exhibition site for our MathHacks 2026 project: a digital chip, designed in Verilog, that computes procedural art from pixel coordinates.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # expression engine + Verilog adapter tests
npm run build      # type-check + production build into dist/
```

## Sections

| # | Section | What it does |
|---|---|---|
| 00 | Experience | VGA viewport (640×480, RGB222), run/pause/restart, patterns, parameters, colour maps, loupe, grid, pixel probe, fullscreen, PNG export |
| 00·B | Physical Layout | Layout viewer right below the artwork (2D pan/zoom once a GDS render is configured; 3D planned) |
| 01 | The Mathematics | Bitwise ALU experiment, formula → picture explorer, step-by-step pixel inspector |
| 02 | Verilog Lab | Gates, shifts, registers/clock with waveforms, editable pixel expression |
| 03 | Code → Silicon | Six-stage flow explainer with illustrations and artifact slots, linking back up to the layout viewer |
| 04 | Our Process | Engineering journal driven by data |

Keys: `0`–`4` sections · `Space` run/pause · `R` restart · `[` `]` pattern · `F` fullscreen · `G` grid · `P` presentation mode · `?` help.

**Presentation mode** (`P`) hides integration notes and journal entries the team hasn't written yet.

## What is real, and what isn't yet

- **Reference demo**: our demo formulas evaluated in JavaScript. It is always labelled as *not hardware output*.
- **Verilog sim**: our actual design, compiled to WASM with Verilator and simulated cycle by cycle. Sources are loaded straight from the repo-root `src/` folder — the same files Tiny Tapeout hardens. Setup notes: [`hardware/README.md`](hardware/README.md).
- **Illustrations** in section 03 use a 2-bit XOR example and are labelled as not our design.
- **Physical layout viewer**: blank until a real GDS render is configured.

## Where to fill in real content

| File | Content |
|---|---|
| `../src/*.v` | the design's Verilog sources (single copy, shared with the Tiny Tapeout flow) |
| `src/simulator/hardware-manifest.ts` | what each `ui_in` bit does (controls are generated from this) |
| `src/simulator/backend.ts` | HDL simulation backend registration (tested snippet in `hardware/README.md`) |
| `src/components/chip-viewer/layout-source.ts` | GDS render image (2D viewer) / glTF model (planned 3D) |
| `src/data/silicon-stages.ts` | per-stage screenshots and report excerpts |
| `src/data/project-process.ts` | engineering journal entries |
| `src/data/project.ts` | project name (working title), team, links |

## Architecture

```
src/
  math/
    expr/                 Verilog expression subset: parser, IEEE 1364 width analysis,
                          compiler to a fast JS loop, step-by-step tracer
    pattern-generators.ts demo patterns, colour maps (v[7:0] → RGB222), frame renderer
    pixel-inspector.ts    per-pixel trace using the active formula + colour map
    bitwise.ts            fixed-width ops for the ALU experiment
  simulator/
    simulator-interface.ts  ArtSimulator contract; the UI shows only the controls a simulator reports
    browser-demo.ts         reference demo implementation
    verilog-adapter.ts      runs an HdlModule, decodes TinyVGA pins, captures frames
    tinyvga.ts              uo_out pin map + 640×480 timing
    hardware-manifest.ts    hardware integration point
  components/             navigation, art-viewer, controls, math, verilog-lab, chip-viewer, engineering-process
  data/                   lessons, flow stages, journal, project identity
```

The demo, the math explorer, the pixel inspector and lesson 04 all share one expression engine. The trace shown for a pixel always comes from the same compiled formula that drew it, and tests check the fast path against the tracer.

Expressions follow Verilog's unsigned sizing rules. For example, `x * y` with 10-bit operands is 10 bits wide, while an unsized literal like `320` widens the expression to 32 bits.

## Credits

Simulator architecture and the TinyVGA pin convention were studied from the [Tiny Tapeout VGA Playground](https://github.com/TinyTapeout/vga-playground) (GPL-3.0). No code is copied into this repository. Fonts: JetBrains Mono, IBM Plex Sans (SIL OFL).
