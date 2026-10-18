export type BitOp = 'AND' | 'OR' | 'XOR' | 'NOT' | 'SHL' | 'SHR';

export interface BitOpInfo {
  op: BitOp;
  symbol: string;
  verilog: (a: string, b: string, n: number) => string;
  operand: 'b' | 'n' | 'none';
  rule: string;
}

export const BIT_OPS: BitOpInfo[] = [
  { op: 'AND', symbol: '&', verilog: (a, b) => `${a} & ${b}`, operand: 'b', rule: '1 only where both bits are 1' },
  { op: 'OR', symbol: '|', verilog: (a, b) => `${a} | ${b}`, operand: 'b', rule: '1 where either bit is 1' },
  { op: 'XOR', symbol: '^', verilog: (a, b) => `${a} ^ ${b}`, operand: 'b', rule: '1 where the bits differ' },
  { op: 'NOT', symbol: '~', verilog: (a) => `~${a}`, operand: 'none', rule: 'every bit is flipped' },
  { op: 'SHL', symbol: '<<', verilog: (a, _b, n) => `${a} << ${n}`, operand: 'n', rule: 'bits move left, zeros enter on the right, the top bits fall off' },
  { op: 'SHR', symbol: '>>', verilog: (a, _b, n) => `${a} >> ${n}`, operand: 'n', rule: 'bits move right, zeros enter on the left, the low bits fall off' },
];

export function mask(width: number): number {
  return width >= 32 ? 0xffffffff : (1 << width) - 1;
}

export function applyBitOp(op: BitOp, a: number, b: number, n: number, width: number): number {
  const m = mask(width);
  switch (op) {
    case 'AND':
      return (a & b) & m;
    case 'OR':
      return (a | b) & m;
    case 'XOR':
      return (a ^ b) & m;
    case 'NOT':
      return ~a & m;
    case 'SHL':
      return n >= width ? 0 : (a << n) & m;
    case 'SHR':
      return n >= width ? 0 : (a & m) >>> n;
  }
}

export function bitsOf(value: number, width: number): number[] {
  const out: number[] = [];
  for (let i = width - 1; i >= 0; i--) out.push((value >>> i) & 1);
  return out;
}

export function droppedBits(op: BitOp, n: number, width: number): Set<number> {
  const out = new Set<number>();
  if (op === 'SHL') for (let i = 0; i < Math.min(n, width); i++) out.add(i);
  if (op === 'SHR') for (let i = 0; i < Math.min(n, width); i++) out.add(width - 1 - i);
  return out;
}

export function filledBits(op: BitOp, n: number, width: number): Set<number> {
  const out = new Set<number>();
  if (op === 'SHL') for (let i = 0; i < Math.min(n, width); i++) out.add(width - 1 - i);
  if (op === 'SHR') for (let i = 0; i < Math.min(n, width); i++) out.add(i);
  return out;
}
