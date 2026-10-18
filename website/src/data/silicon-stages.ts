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
  awaiting: string;
  artifacts: StageArtifact[];
}

export const SILICON_STAGES: SiliconStage[] = [
  {
    id: 'math',
    name: 'Mathematics',
    transform: 'idea → integer formula',
    tools: 'paper, quick software prototypes',
    explain:
      'The artwork starts as a function that maps pixel coordinates to a colour. In hardware every value has a fixed number of bits, so widths, overflow and wrap-around are part of the design from the start.',
    changes: 'Nothing is hardware yet. The formula sets what every later stage has to build.',
    awaiting: 'sketches or the prototype formulas we started from',
    artifacts: [],
  },
  {
    id: 'rtl',
    name: 'Verilog RTL',
    transform: 'formula → register-transfer description',
    tools: 'Verilog, simulation (e.g. Verilator, Icarus, cocotb)',
    explain:
      'RTL (register-transfer level) describes the registers and the logic between them. Simulation runs the description cycle by cycle, so the picture can be checked before any hardware exists.',
    changes: 'The formula becomes concrete wires and registers with declared widths. VGA designs are usually clocked at the 25.175 MHz pixel clock.',
    awaiting: 'a key excerpt of project.v and a simulator screenshot',
    artifacts: [],
  },
  {
    id: 'synth',
    name: 'Synthesis',
    transform: 'RTL → gate-level netlist',
    tools: 'Yosys',
    explain:
      'Synthesis converts the behavioural description into a netlist built from the standard cells of a process design kit (PDK): AND, XOR, flip-flops and so on. It optimises the logic and reports how many cells the design uses.',
    changes: 'Operators like ^ and + turn into specific library cells connected by named nets.',
    awaiting: 'the synthesis cell-count report (yosys stat)',
    artifacts: [],
  },
  {
    id: 'place',
    name: 'Placement',
    transform: 'netlist → cells at positions',
    tools: 'OpenROAD',
    explain:
      'Each standard cell is assigned an exact position in rows that share power rails. Tap and filler cells fill the gaps. The placer tries to keep connected cells close together to shorten the wires.',
    changes: 'Cells now have physical sizes and coordinates, but they are not connected yet.',
    awaiting: 'a placement screenshot or density report',
    artifacts: [],
  },
  {
    id: 'route',
    name: 'Routing',
    transform: 'placed cells → metal wiring',
    tools: 'OpenROAD (global + detailed routing)',
    explain:
      'The router connects every net with metal wires on several stacked layers, linked by vias. Checks then confirm that the layout obeys the manufacturing rules (DRC) and still matches the netlist (LVS).',
    changes: 'Metal wires and vias are added on top of the cells. Logical connections become physical ones.',
    awaiting: 'a routed-layout screenshot and the DRC/LVS summary',
    artifacts: [],
  },
  {
    id: 'layout',
    name: 'Physical layout',
    transform: 'routed design → GDSII',
    tools: 'Magic / KLayout (GDS export)',
    explain:
      'The final output is a GDSII file: polygons on each process layer, the format a foundry uses to make photomasks. What we show is this generated physical design, not a photograph of a manufactured chip.',
    changes: 'The design is now pure geometry, layer by layer.',
    awaiting: 'the GDS render of our tile',
    artifacts: [],
  },
];
