export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '&'
  | '|'
  | '^'
  | '~^'
  | '<<'
  | '>>'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '&&'
  | '||';

export type UnaryOp = '-' | '+' | '~' | '!' | '&' | '|' | '^';

interface Base {
  start: number;
  end: number;
  sw?: number;
  w?: number;
}

export interface NumNode extends Base {
  type: 'num';
  value: number;
  size: number;
  sized: boolean;
  raw: string;
}

export interface IdentNode extends Base {
  type: 'ident';
  name: string;
}

export interface SelectNode extends Base {
  type: 'select';
  name: string;
  msb: number;
  lsb: number;
}

export interface UnaryNode extends Base {
  type: 'unary';
  op: UnaryOp;
  arg: Node;
}

export interface BinaryNode extends Base {
  type: 'binary';
  op: BinaryOp;
  left: Node;
  right: Node;
}

export interface TernaryNode extends Base {
  type: 'ternary';
  cond: Node;
  then: Node;
  else: Node;
}

export interface ConcatNode extends Base {
  type: 'concat';
  parts: Node[];
}

export type Node = NumNode | IdentNode | SelectNode | UnaryNode | BinaryNode | TernaryNode | ConcatNode;

export interface SymbolInfo {
  width: number;
  description: string;
}

export type SymbolTable = Record<string, SymbolInfo>;

export class ExprError extends Error {
  constructor(
    message: string,
    public readonly start: number,
    public readonly end: number,
  ) {
    super(message);
    this.name = 'ExprError';
  }
}

export const MAX_WIDTH = 32;

export function maskOf(width: number): number {
  return width >= 32 ? 0xffffffff : 2 ** width - 1;
}

export function wrap(value: number, width: number): number {
  return width >= 32 ? value >>> 0 : (value & maskOf(width)) >>> 0;
}
