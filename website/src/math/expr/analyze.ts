import { ExprError, MAX_WIDTH, Node, SymbolTable } from './ast';

function selfWidth(node: Node, symbols: SymbolTable): number {
  let w: number;
  switch (node.type) {
    case 'num':
      w = node.size;
      break;
    case 'ident': {
      const sym = symbols[node.name];
      if (!sym) throw unknownSymbol(node.name, node.start, node.end, symbols);
      w = sym.width;
      break;
    }
    case 'select': {
      const sym = symbols[node.name];
      if (!sym) throw unknownSymbol(node.name, node.start, node.start + node.name.length, symbols);
      if (node.msb >= sym.width) {
        throw new ExprError(`${node.name} is ${sym.width} bits wide ([${sym.width - 1}:0]); bit ${node.msb} does not exist.`, node.start, node.end);
      }
      w = node.msb - node.lsb + 1;
      break;
    }
    case 'unary':
      w = selfWidth(node.arg, symbols);
      if (node.op === '!' || node.op === '&' || node.op === '|' || node.op === '^') w = 1;
      break;
    case 'binary': {
      const l = selfWidth(node.left, symbols);
      const r = selfWidth(node.right, symbols);
      switch (node.op) {
        case '<<':
        case '>>':
          w = l;
          break;
        case '==':
        case '!=':
        case '<':
        case '<=':
        case '>':
        case '>=':
        case '&&':
        case '||':
          w = 1;
          break;
        default:
          w = Math.max(l, r);
      }
      break;
    }
    case 'ternary':
      selfWidth(node.cond, symbols);
      w = Math.max(selfWidth(node.then, symbols), selfWidth(node.else, symbols));
      break;
    case 'concat':
      w = node.parts.reduce((sum, p) => sum + selfWidth(p, symbols), 0);
      break;
  }
  if (w > MAX_WIDTH) {
    throw new ExprError(`This subexpression is ${w} bits wide; the subset supports at most ${MAX_WIDTH} bits.`, node.start, node.end);
  }
  node.sw = w;
  return w;
}

function propagate(node: Node, w: number): void {
  node.w = w;
  switch (node.type) {
    case 'unary':
      if (node.op === '-' || node.op === '+' || node.op === '~') propagate(node.arg, w);
      else propagate(node.arg, node.arg.sw!);
      break;
    case 'binary':
      switch (node.op) {
        case '<<':
        case '>>':
          propagate(node.left, w);
          propagate(node.right, node.right.sw!);
          break;
        case '==':
        case '!=':
        case '<':
        case '<=':
        case '>':
        case '>=': {
          const m = Math.max(node.left.sw!, node.right.sw!);
          propagate(node.left, m);
          propagate(node.right, m);
          break;
        }
        case '&&':
        case '||':
          propagate(node.left, node.left.sw!);
          propagate(node.right, node.right.sw!);
          break;
        default:
          propagate(node.left, w);
          propagate(node.right, w);
      }
      break;
    case 'ternary':
      propagate(node.cond, node.cond.sw!);
      propagate(node.then, w);
      propagate(node.else, w);
      break;
    case 'concat':
      for (const p of node.parts) propagate(p, p.sw!);
      break;
    default:
      break;
  }
}

function unknownSymbol(name: string, start: number, end: number, symbols: SymbolTable): ExprError {
  const known = Object.keys(symbols).join(', ');
  return new ExprError(`Unknown signal '${name}'. Available: ${known}.`, start, end);
}

export function analyze(root: Node, symbols: SymbolTable, lhsWidth: number): number {
  const sw = selfWidth(root, symbols);
  const w = Math.max(sw, lhsWidth);
  propagate(root, w);
  return w;
}

export function collectIdentifiers(root: Node): Set<string> {
  const out = new Set<string>();
  const visit = (n: Node) => {
    switch (n.type) {
      case 'ident':
      case 'select':
        out.add(n.name);
        break;
      case 'unary':
        visit(n.arg);
        break;
      case 'binary':
        visit(n.left);
        visit(n.right);
        break;
      case 'ternary':
        visit(n.cond);
        visit(n.then);
        visit(n.else);
        break;
      case 'concat':
        n.parts.forEach(visit);
        break;
    }
  };
  visit(root);
  return out;
}
