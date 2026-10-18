import { analyze, collectIdentifiers } from './analyze';
import { ExprError, Node, SymbolTable, maskOf, wrap } from './ast';
import { parseExpression } from './parse';

export interface CompiledExpr {
  source: string;
  root: Node;
  width: number;
  lhsWidth: number;
  symbols: SymbolTable;
  identifiers: Set<string>;
  js: string;
  evaluate(env: Record<string, number>): number;
}

const HELPERS = `
const $shl = (l, r, w, m) => r >= w ? 0 : (w >= 32 ? (l << r) >>> 0 : (l << r) & m);
const $shr = (l, r) => r >= 32 ? 0 : l >>> r;
const $par = (v) => { v ^= v >>> 16; v ^= v >>> 8; v ^= v >>> 4; v ^= v >>> 2; v ^= v >>> 1; return v & 1; };
`;

export const JS_HELPERS = HELPERS;

function m(code: string, w: number): string {
  return w >= 32 ? `((${code}) >>> 0)` : `((${code}) & ${maskOf(w)})`;
}

function gen(node: Node): string {
  const w = node.w!;
  switch (node.type) {
    case 'num':
      return String(node.value);
    case 'ident':
      return node.name;
    case 'select':
      return m(`${node.name} >>> ${node.lsb}`, node.msb - node.lsb + 1);
    case 'unary': {
      const a = gen(node.arg);
      switch (node.op) {
        case '-':
          return m(`-${a}`, w);
        case '+':
          return a;
        case '~':
          return m(`~${a}`, w);
        case '!':
          return `(${a} === 0 ? 1 : 0)`;
        case '&':
          return `(${a} === ${maskOf(node.arg.w!)} ? 1 : 0)`;
        case '|':
          return `(${a} !== 0 ? 1 : 0)`;
        case '^':
          return `$par(${a})`;
      }
      break;
    }
    case 'binary': {
      const a = gen(node.left);
      const b = gen(node.right);
      switch (node.op) {
        case '+':
          return m(`${a} + ${b}`, w);
        case '-':
          return m(`${a} - ${b}`, w);
        case '*':
          return m(`Math.imul(${a}, ${b})`, w);
        case '&':
          return m(`${a} & ${b}`, w);
        case '|':
          return m(`${a} | ${b}`, w);
        case '^':
          return m(`${a} ^ ${b}`, w);
        case '~^':
          return m(`~(${a} ^ ${b})`, w);
        case '<<':
          return `$shl(${a}, ${b}, ${w}, ${maskOf(w)})`;
        case '>>':
          return `$shr(${a}, ${b})`;
        case '==':
          return `(${a} === ${b} ? 1 : 0)`;
        case '!=':
          return `(${a} !== ${b} ? 1 : 0)`;
        case '<':
          return `(${a} < ${b} ? 1 : 0)`;
        case '<=':
          return `(${a} <= ${b} ? 1 : 0)`;
        case '>':
          return `(${a} > ${b} ? 1 : 0)`;
        case '>=':
          return `(${a} >= ${b} ? 1 : 0)`;
        case '&&':
          return `(${a} !== 0 && ${b} !== 0 ? 1 : 0)`;
        case '||':
          return `(${a} !== 0 || ${b} !== 0 ? 1 : 0)`;
      }
      break;
    }
    case 'ternary':
      return `(${gen(node.cond)} !== 0 ? ${gen(node.then)} : ${gen(node.else)})`;
    case 'concat': {
      let offset = 0;
      const terms: string[] = [];
      for (let i = node.parts.length - 1; i >= 0; i--) {
        const p = node.parts[i];
        terms.push(offset === 0 ? gen(p) : `${gen(p)} * ${2 ** offset}`);
        offset += p.w!;
      }
      return `(${terms.join(' + ')})`;
    }
  }
  throw new Error('unreachable');
}

export function compileExpression(source: string, symbols: SymbolTable, lhsWidth: number): CompiledExpr {
  const root = parseExpression(source);
  const width = analyze(root, symbols, lhsWidth);
  const js = gen(root);
  const names = Object.keys(symbols);
  const fn = new Function(...names, `${HELPERS}\nreturn ${m(js, lhsWidth)};`) as (...args: number[]) => number;
  return {
    source,
    root,
    width,
    lhsWidth,
    symbols,
    identifiers: collectIdentifiers(root),
    js,
    evaluate: (env) => fn(...names.map((n) => wrap(env[n] ?? 0, symbols[n].width))),
  };
}

export function tryCompile(
  source: string,
  symbols: SymbolTable,
  lhsWidth: number,
): { ok: true; expr: CompiledExpr } | { ok: false; error: ExprError } {
  try {
    return { ok: true, expr: compileExpression(source, symbols, lhsWidth) };
  } catch (e) {
    if (e instanceof ExprError) return { ok: false, error: e };
    throw e;
  }
}

export interface TraceOperand {
  text: string;
  value: number;
  width: number;
}

export interface TraceStep {
  text: string;
  start: number;
  end: number;
  op: string;
  label: string;
  width: number;
  value: number;
  operands: TraceOperand[];
  note?: string;
}

export interface TraceInput {
  name: string;
  value: number;
  width: number;
  description: string;
}

export interface Trace {
  inputs: TraceInput[];
  steps: TraceStep[];
  rootWidth: number;
  lhsWidth: number;
  rawValue: number;
  value: number;
}

const OP_LABELS: Record<string, string> = {
  '+': 'ADD',
  '-': 'SUBTRACT',
  '*': 'MULTIPLY',
  '&': 'AND',
  '|': 'OR',
  '^': 'XOR',
  '~^': 'XNOR',
  '<<': 'SHIFT LEFT',
  '>>': 'SHIFT RIGHT',
  '==': 'EQUAL',
  '!=': 'NOT EQUAL',
  '<': 'LESS THAN',
  '<=': 'LESS OR EQUAL',
  '>': 'GREATER THAN',
  '>=': 'GREATER OR EQUAL',
  '&&': 'LOGICAL AND',
  '||': 'LOGICAL OR',
  'u-': 'NEGATE',
  'u+': 'PLUS',
  'u~': 'NOT',
  'u!': 'LOGICAL NOT',
  'u&': 'REDUCE AND',
  'u|': 'REDUCE OR',
  'u^': 'REDUCE XOR',
  '?:': 'SELECT',
  '{}': 'CONCATENATE',
  '[]': 'BIT SELECT',
};

function bitLength(v: bigint): number {
  return v <= 0n ? 1 : v.toString(2).length;
}

export function traceExpression(expr: CompiledExpr, env: Record<string, number>): Trace {
  const { source, symbols } = expr;
  const steps: TraceStep[] = [];
  const val = (name: string) => wrap(env[name] ?? 0, symbols[name].width);

  const push = (node: Node, key: string, value: number, operands: Node[], vals: number[], note?: string) => {
    steps.push({
      text: source.slice(node.start, node.end).trim(),
      start: node.start,
      end: node.end,
      op: key,
      label: OP_LABELS[key] ?? key,
      width: node.w!,
      value,
      operands: operands.map((o, i) => ({ text: source.slice(o.start, o.end).trim(), value: vals[i], width: o.w! })),
      note,
    });
    return value;
  };

  function ev(node: Node): number {
    const w = node.w!;
    switch (node.type) {
      case 'num':
        return node.value;
      case 'ident':
        return val(node.name);
      case 'select': {
        const v = wrap(val(node.name) >>> node.lsb, node.msb - node.lsb + 1);
        const note = `bits [${node.msb}:${node.lsb}] of ${node.name}`;
        steps.push({
          text: source.slice(node.start, node.end).trim(),
          start: node.start,
          end: node.end,
          op: '[]',
          label: OP_LABELS['[]'],
          width: node.msb - node.lsb + 1,
          value: v,
          operands: [{ text: node.name, value: val(node.name), width: symbols[node.name].width }],
          note,
        });
        return v;
      }
      case 'unary': {
        const a = ev(node.arg);
        let v: number;
        let note: string | undefined;
        switch (node.op) {
          case '-':
            v = wrap(-a, w);
            if (a !== 0) note = `unsigned negation wraps: 2^${w} − ${a}`;
            break;
          case '+':
            v = a;
            break;
          case '~':
            v = wrap(~a, w);
            note = `every one of the ${w} bits is flipped`;
            break;
          case '!':
            v = a === 0 ? 1 : 0;
            break;
          case '&':
            v = a === maskOf(node.arg.w!) ? 1 : 0;
            break;
          case '|':
            v = a !== 0 ? 1 : 0;
            break;
          case '^': {
            let p = a;
            p ^= p >>> 16;
            p ^= p >>> 8;
            p ^= p >>> 4;
            p ^= p >>> 2;
            p ^= p >>> 1;
            v = p & 1;
            break;
          }
        }
        return push(node, `u${node.op}`, v, [node.arg], [a], note);
      }
      case 'binary': {
        const a = ev(node.left);
        const b = ev(node.right);
        const mask = maskOf(w);
        let v: number;
        let note: string | undefined;
        switch (node.op) {
          case '+': {
            const exact = BigInt(a) + BigInt(b);
            v = wrap(a + b, w);
            if (exact > BigInt(mask)) note = `carry out: the true sum ${exact} needs ${bitLength(exact)} bits, only the low ${w} are kept`;
            break;
          }
          case '-':
            v = wrap(a - b, w);
            if (a < b) note = `borrow: ${a} − ${b} is negative, so it wraps around modulo 2^${w}`;
            break;
          case '*': {
            const exact = BigInt(a) * BigInt(b);
            v = wrap(Math.imul(a, b), w);
            if (exact > BigInt(mask)) note = `overflow: the true product ${exact} needs ${bitLength(exact)} bits, only the low ${w} are kept`;
            break;
          }
          case '&':
            v = wrap(a & b, w);
            break;
          case '|':
            v = wrap(a | b, w);
            break;
          case '^':
            v = wrap(a ^ b, w);
            break;
          case '~^':
            v = wrap(~(a ^ b), w);
            break;
          case '<<': {
            v = b >= w ? 0 : wrap(a << b, w);
            const exact = BigInt(a) << BigInt(Math.min(b, 64));
            if (exact > BigInt(mask)) note = `bits pushed past bit ${w - 1} fall off the ${w}-bit result`;
            else if (b > 0) note = `same as multiplying by 2^${b} = ${2 ** Math.min(b, 31)}`;
            break;
          }
          case '>>':
            v = b >= 32 ? 0 : a >>> b;
            if (b > 0) note = `the low ${Math.min(b, w)} bit${b === 1 ? '' : 's'} fall off; same as ⌊${a} / 2^${b}⌋`;
            break;
          case '==':
            v = a === b ? 1 : 0;
            break;
          case '!=':
            v = a !== b ? 1 : 0;
            break;
          case '<':
            v = a < b ? 1 : 0;
            break;
          case '<=':
            v = a <= b ? 1 : 0;
            break;
          case '>':
            v = a > b ? 1 : 0;
            break;
          case '>=':
            v = a >= b ? 1 : 0;
            break;
          case '&&':
            v = a !== 0 && b !== 0 ? 1 : 0;
            break;
          case '||':
            v = a !== 0 || b !== 0 ? 1 : 0;
            break;
        }
        return push(node, node.op, v, [node.left, node.right], [a, b], note);
      }
      case 'ternary': {
        const c = ev(node.cond);
        const t = ev(node.then);
        const e = ev(node.else);
        const v = c !== 0 ? t : e;
        return push(node, '?:', v, [node.cond, node.then, node.else], [c, t, e], `condition is ${c !== 0 ? 'true' : 'false'}, so the multiplexer passes the ${c !== 0 ? 'first' : 'second'} value`);
      }
      case 'concat': {
        const vals = node.parts.map(ev);
        let v = 0;
        let offset = 0;
        for (let i = node.parts.length - 1; i >= 0; i--) {
          v += vals[i] * 2 ** offset;
          offset += node.parts[i].w!;
        }
        return push(node, '{}', v, node.parts, vals, `fields are placed side by side, leftmost field in the highest bits`);
      }
    }
  }

  const rawValue = ev(expr.root);
  const inputs: TraceInput[] = Object.entries(symbols)
    .filter(([name]) => expr.identifiers.has(name))
    .map(([name, info]) => ({ name, value: val(name), width: info.width, description: info.description }));
  return {
    inputs,
    steps,
    rootWidth: expr.width,
    lhsWidth: expr.lhsWidth,
    rawValue,
    value: wrap(rawValue, expr.lhsWidth),
  };
}

export function toBinary(value: number, width: number): string {
  return (value >>> 0).toString(2).padStart(width, '0').slice(-width);
}

export function toHex(value: number, width: number): string {
  return (value >>> 0)
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(width / 4), '0');
}
