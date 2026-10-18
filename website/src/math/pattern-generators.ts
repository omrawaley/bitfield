import { SymbolTable, wrap } from './expr/ast';
import { CompiledExpr, JS_HELPERS, compileExpression } from './expr/evaluate';

export const ART_SYMBOLS: SymbolTable = {
  x: { width: 10, description: 'horizontal pixel counter (pix_x)' },
  y: { width: 10, description: 'vertical pixel counter (pix_y)' },
  t: { width: 8, description: 'time: 8-bit frame counter' },
  s: { width: 3, description: 'shift amount parameter' },
  k: { width: 8, description: 'constant parameter' },
};

export const PIXEL_WIDTH = 8;

export interface ArtParams {
  t: number;
  s: number;
  k: number;
}

export interface PatternDef {
  id: string;
  name: string;
  expr: string;
  explain: string;
  defaults: { s: number; k: number; map: string };
}

export const DEMO_PATTERNS: PatternDef[] = [
  {
    id: 'lattice',
    name: 'XOR LATTICE',
    expr: '((x >> s) ^ (y >> s)) + t',
    explain:
      'XOR compares the binary digits of x and y. Each result bit is 1 where they differ and 0 where they agree. Every bit position repeats with its own power-of-two period, so the screen splits into nested squares. Shifting right by s makes the smallest square 2^s pixels wide, and adding t cycles the colours.',
    defaults: { s: 2, k: 0, map: 'high' },
  },
  {
    id: 'rings',
    name: 'MOIRÉ RINGS',
    expr: '(((x - 320) * (x - 320) + (y - 240) * (y - 240)) >> (s + 4)) + t',
    explain:
      'This computes the squared distance from the screen centre. The literals 320 and 240 are unsized, so Verilog evaluates the expression at 32 bits and the squares never overflow. Shifting right cuts the distance into rings of equal area, so the rings get thinner as they move outward. Once a ring is narrower than a pixel, the sampling aliases and moiré patterns appear.',
    defaults: { s: 0, k: 0, map: 'high' },
  },
  {
    id: 'hyperbola',
    name: 'HYPERBOLA FIELD',
    expr: "((x * y + 20'd0) >> (s + 6)) + t",
    explain:
      "Points with the same product x·y lie on a hyperbola. Without the 20'd0 term, Verilog would size x * y like its 10-bit operands and drop the top half of the product. Adding a 20-bit literal widens the expression to 20 bits so the full product survives. The shift chooses which product bits become the colour.",
    defaults: { s: 0, k: 0, map: 'high' },
  },
  {
    id: 'interference',
    name: 'RING INTERFERENCE',
    expr: '((((x - 320) * (x - 320) + (y - 240) * (y - 240)) >> 8) + t) ^ ((x ^ y) >> s)',
    explain:
      'Concentric rings XOR-ed with an XOR lattice. Wherever the lattice has a 1 bit, the matching ring bit flips, so the rings swap colour from square to square. Raising s enlarges the lattice squares.',
    defaults: { s: 2, k: 0, map: 'high' },
  },
  {
    id: 'sierpinski',
    name: 'SIERPINSKI SIEVE',
    expr: '((x >> s) & ((y + t) >> s)) == 0 ? (x ^ y) >> 2 : k',
    explain:
      'x & y is zero only when x and y never have a 1 in the same bit position. Plotting those points draws Sierpiński’s triangle, the same shape as the odd numbers in Pascal’s triangle. Adding t to y scrolls it vertically, wrapping at 10 bits. A multiplexer outputs (x ^ y) >> 2 inside the triangle and the constant k everywhere else.',
    defaults: { s: 1, k: 0, map: 'direct' },
  },
  {
    id: 'weave',
    name: 'DIAGONAL WEAVE',
    expr: '(((x + y + t) >> s) ^ ((x - y - t) >> s)) | k',
    explain:
      'x + y is constant along one diagonal direction and x − y along the other. XOR-ing the two shifted counters crosses the two stripe families, and the ± t terms move them in different directions. OR-ing with k forces chosen bits on.',
    defaults: { s: 3, k: 0, map: 'split' },
  },
  {
    id: 'tartan',
    name: 'TARTAN',
    expr: '(((x >> s) | (y >> s)) ^ ((x >> (s + 2)) & (y >> (s + 2)))) + t',
    explain:
      'Bit i of (x >> s) | (y >> s) is set when either coordinate has that bit set. Vertical stripes from x overlap horizontal stripes from y to form a grid of bars. XOR-ing with a coarser AND term, which is set only where both coordinates have a bit, inverts the crossings and gives the woven look.',
    defaults: { s: 1, k: 0, map: 'split' },
  },
];

export const COLOR_SYMBOLS: SymbolTable = {
  v: { width: 8, description: 'pixel value v[7:0]' },
};

export interface ColorMapDef {
  id: string;
  name: string;
  r: string;
  g: string;
  b: string;
  note: string;
}

export const COLOR_MAPS: ColorMapDef[] = [
  { id: 'direct', name: 'DIRECT', r: 'v[5:4]', g: 'v[3:2]', b: 'v[1:0]', note: 'Low six bits wired straight to the three 2-bit DACs.' },
  { id: 'high', name: 'HIGH BITS', r: 'v[7:6]', g: 'v[6:5]', b: 'v[5:4]', note: 'Uses the slowly changing top bits, so colours change in wide smooth bands.' },
  { id: 'split', name: 'SPLIT', r: 'v[7:6]', g: 'v[5:4] ^ v[7:6]', b: 'v[3:2]', note: 'Green is the XOR of two fields, which separates hues.' },
  { id: 'phosphor', name: 'PHOSPHOR', r: '{1\'b0, v[7] & v[6]}', g: 'v[7:6]', b: '{1\'b0, v[7] & v[6]}', note: 'Green only, like a monochrome terminal. The brightest level adds a little red and blue.' },
  { id: 'amber', name: 'AMBER', r: 'v[7:6]', g: '{1\'b0, v[7]}', b: '2\'b00', note: 'Red and half-strength green, like an amber monitor.' },
  { id: 'invert', name: 'INVERT', r: '~v[5:4]', g: '~v[3:2]', b: '~v[1:0]', note: 'Same as DIRECT with every output bit inverted.' },
];

export interface CompiledColorMap {
  def: ColorMapDef;
  r: CompiledExpr;
  g: CompiledExpr;
  b: CompiledExpr;
  lut: Uint32Array;
}

export const DAC_LEVEL = 85;

export function packRGBA(r8: number, g8: number, b8: number): number {
  return ((0xff << 24) | (b8 << 16) | (g8 << 8) | r8) >>> 0;
}

export function compileColorMap(def: ColorMapDef): CompiledColorMap {
  const r = compileExpression(def.r, COLOR_SYMBOLS, 2);
  const g = compileExpression(def.g, COLOR_SYMBOLS, 2);
  const b = compileExpression(def.b, COLOR_SYMBOLS, 2);
  const lut = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = packRGBA(r.evaluate({ v }) * DAC_LEVEL, g.evaluate({ v }) * DAC_LEVEL, b.evaluate({ v }) * DAC_LEVEL);
  }
  return { def, r, g, b, lut };
}

const colorMapCache = new Map<string, CompiledColorMap>();

export function getColorMap(id: string): CompiledColorMap {
  let cm = colorMapCache.get(id);
  if (!cm) {
    cm = compileColorMap(COLOR_MAPS.find((c) => c.id === id) ?? COLOR_MAPS[0]);
    colorMapCache.set(id, cm);
  }
  return cm;
}

export function rgb222(v: number, cm: CompiledColorMap): [number, number, number] {
  return [cm.r.evaluate({ v }), cm.g.evaluate({ v }), cm.b.evaluate({ v })];
}

export type FrameRenderer = (
  out: Uint32Array,
  width: number,
  height: number,
  originX: number,
  originY: number,
  params: ArtParams,
  lut: Uint32Array,
) => void;

export function buildFrameRenderer(expr: CompiledExpr): FrameRenderer {
  if (expr.symbols !== ART_SYMBOLS) throw new Error('Frame renderer requires ART_SYMBOLS expressions');
  const body = `${JS_HELPERS}
return function render(out, W, H, ox, oy, t, s, k, lut) {
  let i = 0;
  for (let py = 0; py < H; py++) {
    const y = (py + oy) & 1023;
    for (let px = 0; px < W; px++) {
      const x = (px + ox) & 1023;
      out[i++] = lut[(${expr.js}) & 255];
    }
  }
};`;
  const inner = new Function(body)() as (...a: unknown[]) => void;
  return (out, W, H, ox, oy, p, lut) =>
    inner(out, W, H, ox, oy, wrap(p.t, 8), wrap(p.s, 3), wrap(p.k, 8), lut);
}

export interface CompiledPattern {
  def: PatternDef;
  expr: CompiledExpr;
  render: FrameRenderer;
}

const patternCache = new Map<string, CompiledPattern>();

export function compilePatternSource(source: string): CompiledPattern {
  const expr = compileExpression(source, ART_SYMBOLS, PIXEL_WIDTH);
  return {
    def: { id: 'custom', name: 'CUSTOM', expr: source, explain: '', defaults: { s: 0, k: 0, map: 'direct' } },
    expr,
    render: buildFrameRenderer(expr),
  };
}

export function getPattern(def: PatternDef): CompiledPattern {
  let p = patternCache.get(def.expr);
  if (!p) {
    const expr = compileExpression(def.expr, ART_SYMBOLS, PIXEL_WIDTH);
    p = { def, expr, render: buildFrameRenderer(expr) };
    patternCache.set(def.expr, p);
  }
  return p;
}
