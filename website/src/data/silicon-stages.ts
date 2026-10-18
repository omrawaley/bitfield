import { layoutSource } from '../components/chip-viewer/layout-source';

export interface StageArtifact {
  kind: 'image' | 'text';
  src?: string;
  content?: string;
  caption: string;
}

export interface SiliconStage {
  id: string;
  name: string;
  transform: string;
  tools: string;
  explain: string;
  changes: string;
  artifacts: StageArtifact[];
}

const FORMULAS = [
  'lattice       ((x >> s) ^ (y >> s)) + t',
  'rings         (d2 >> (s + 4)) + t                    d2 = |x-320|² + |y-240|²',
  'hyperbola     ((x * y) >> (s + 6)) + t',
  'interference  ((d2 >> 8) + t) ^ ((x ^ y) >> s)',
  'sierpinski    ((x >> s) & ((y + t) >> s)) == 0 ? (x ^ y) >> 2 : 0',
  'weave         ((x + y + t) >>> s) ^ ((x - y - t) >>> s)',
  'tartan        (((x >> s) | (y >> s)) ^ ((x >> (s+2)) & (y >> (s+2)))) + t',
].join('\n');

export const SILICON_STAGES: SiliconStage[] = [
  {
    id: 'math',
    name: 'Mathematics',
    transform: 'idea → integer formula',
    tools: 'paper, quick software prototypes',
    explain:
      'The artwork starts as a function that maps pixel coordinates to a colour. In hardware every value has a fixed number of bits, so widths, overflow and wrap-around are part of the design from the start.',
    changes: 'Nothing is hardware yet. The formula sets what every later stage has to build.',
    artifacts: [
      {
        kind: 'text',
        content: 'v = ((x >> 2) ^ (y >> 2)) + t',
        caption:
          'The formula the chip opens with — the XOR lattice. Shifting the coordinates before the XOR sets the square size; t advances once per frame, so the lattice scrolls.',
      },
    ],
  },
  {
    id: 'rtl',
    name: 'Verilog RTL',
    transform: 'formula → register-transfer description',
    tools: 'Verilog, simulation (Verilator, cocotb)',
    explain:
      'RTL (register-transfer level) describes the registers and the logic between them. Simulation runs the description cycle by cycle, so the picture can be checked before any hardware exists.',
    changes: 'The formula becomes concrete wires and registers with declared widths, clocked by the 25.175 MHz pixel clock.',
    artifacts: [
      {
        kind: 'text',
        content: FORMULAS,
        caption:
          'All seven patterns, from src/project.v. x and y are the VGA counters, every value is 8-bit, and s is the 2-bit shift amount — the same equations the website evaluates.',
      },
    ],
  },
  {
    id: 'synth',
    name: 'Synthesis',
    transform: 'RTL → gate-level netlist',
    tools: 'Yosys',
    explain:
      'Synthesis converts the behavioural description into a netlist built from the standard cells of a process design kit (PDK): AND, XOR, flip-flops and so on. It optimises the logic and reports how many cells the design uses.',
    changes: 'Operators like ^ and + turn into specific library cells connected by named nets.',
    artifacts: [
      {
        kind: 'text',
        content:
          '2,022 cells mapped from the RTL: 38 flip-flops and 1,984 combinational cells (67 sky130 cell types). Mapped area 20,171 µm², 4.95% of it sequential logic.',
        caption: 'yosys stat from our tapeout build log — before placement adds fillers and tap cells.',
      },
    ],
  },
  {
    id: 'place',
    name: 'Placement',
    transform: 'netlist → cells at positions',
    tools: 'OpenROAD',
    explain:
      'Each standard cell is assigned an exact position in rows that share power rails. Tap and filler cells fill the gaps. The placer tries to keep connected cells close together to shorten the wires.',
    changes: 'Cells now have physical sizes and coordinates, but they are not connected yet.',
    artifacts: [
      {
        kind: 'text',
        content:
          '68.4% utilisation: 2,705 standard cells plus 456 tap and 3,439 fill cells, on a 36,347 µm² die. The die is a 1×2 tile because at 1×1 the flow reported 142% utilisation — the design does not fit a single tile.',
        caption: 'Placement metrics from our LibreLane run (metrics.csv).',
      },
    ],
  },
  {
    id: 'route',
    name: 'Routing',
    transform: 'placed cells → metal wiring',
    tools: 'OpenROAD (global + detailed routing)',
    explain:
      'The router connects every net with metal wires on several stacked layers, linked by vias. Checks then confirm that the layout obeys the manufacturing rules (DRC) and still matches the netlist (LVS).',
    changes: 'Metal wires and vias are added on top of the cells. Logical connections become physical ones.',
    artifacts: [
      {
        kind: 'text',
        content:
          'Detailed routing converged 795 → 0 DRC errors over 5 iterations; 0 antenna violations; LVS clean on every check (devices, nets, properties); worst power-grid drop 59 µV.',
        caption: 'Physical verification summary from the same run (metrics.csv).',
      },
      {
        kind: 'text',
        content:
          'Setup slack −4.86 ns against the flow’s 20 ns target ⇒ a ≈24.9 ns critical path, comfortably met by the 25.175 MHz VGA pixel clock (39.7 ns period). Hold slack is 0 ns at every corner.',
        caption: 'Static timing analysis (metrics.csv): the flow runs faster than the pixel clock to catch problems early.',
      },
    ],
  },
  {
    id: 'layout',
    name: 'Physical layout',
    transform: 'routed design → GDSII',
    tools: 'LibreLane, KLayout',
    explain:
      'The final output is a GDSII file: polygons on each process layer, the format a foundry uses to make photomasks. What we show is this generated physical design, not a photograph of a manufactured chip.',
    changes: 'The design is now pure geometry, layer by layer.',
    artifacts: [
      {
        kind: 'image',
        src: layoutSource.image.src,
        caption:
          'The submitted GDSII (sky130A), rendered by our flow and published with this site together with the .gds and .oas files — polygons plus the Tiny Tapeout I/O ring, not a photograph.',
      },
    ],
  },
];
