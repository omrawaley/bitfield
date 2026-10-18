import { BinaryOp, ExprError, MAX_WIDTH, Node, UnaryOp, maskOf } from './ast';

type TokType = 'num' | 'ident' | 'op' | 'eof';

interface Token {
  type: TokType;
  text: string;
  start: number;
  end: number;
}

const MULTI_OPS = ['<<<', '>>>', '~^', '^~', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '**', '~&', '~|'];
const SINGLE_OPS = '+-*&|^~!<>?:()[]{},/%';

const UNSUPPORTED: Record<string, string> = {
  '/': 'Division is not in the supported subset (hardware dividers are large and slow).',
  '%': 'Modulo is not in the supported subset (it needs a divider).',
  '**': 'Exponentiation is not in the supported subset.',
  '<<<': 'Arithmetic shifts are not in the supported subset; use << for unsigned values.',
  '>>>': 'Arithmetic shifts are not in the supported subset; use >> for unsigned values.',
  '~&': 'Reduction NAND is not in the supported subset; write ~(&a) instead.',
  '~|': 'Reduction NOR is not in the supported subset; write ~(|a) instead.',
};

const SIZED_LITERAL = /^(\d+)?'([bBdDhHoO])([0-9a-fA-F_]+)/;
const DECIMAL = /^\d[\d_]*/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (src.startsWith('//', i)) {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    const rest = src.slice(i);
    const sized = SIZED_LITERAL.exec(rest);
    if (sized) {
      tokens.push({ type: 'num', text: sized[0], start: i, end: i + sized[0].length });
      i += sized[0].length;
      continue;
    }
    if (/^\d+'/.test(rest) || rest.startsWith("'")) {
      throw new ExprError('Malformed sized literal. Examples: 8\'hFF, 4\'b1010, 10\'d640.', i, i + 1);
    }
    const dec = DECIMAL.exec(rest);
    if (dec) {
      tokens.push({ type: 'num', text: dec[0], start: i, end: i + dec[0].length });
      i += dec[0].length;
      continue;
    }
    const id = IDENT.exec(rest);
    if (id) {
      tokens.push({ type: 'ident', text: id[0], start: i, end: i + id[0].length });
      i += id[0].length;
      continue;
    }
    const multi = MULTI_OPS.find((op) => src.startsWith(op, i));
    if (multi) {
      if (UNSUPPORTED[multi]) throw new ExprError(UNSUPPORTED[multi], i, i + multi.length);
      tokens.push({ type: 'op', text: multi === '^~' ? '~^' : multi, start: i, end: i + multi.length });
      i += multi.length;
      continue;
    }
    if (SINGLE_OPS.includes(ch)) {
      if (UNSUPPORTED[ch]) throw new ExprError(UNSUPPORTED[ch], i, i + 1);
      tokens.push({ type: 'op', text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    throw new ExprError(`Unexpected character '${ch}'.`, i, i + 1);
  }
  tokens.push({ type: 'eof', text: '', start: src.length, end: src.length });
  return tokens;
}

function parseLiteral(tok: Token): Node {
  const sized = SIZED_LITERAL.exec(tok.text);
  if (!sized) {
    const value = Number(tok.text.replace(/_/g, ''));
    if (value > 0xffffffff) throw new ExprError('Literal does not fit in 32 bits.', tok.start, tok.end);
    return { type: 'num', value, size: 32, sized: false, raw: tok.text, start: tok.start, end: tok.end };
  }
  const size = sized[1] ? Number(sized[1]) : 32;
  if (size < 1 || size > MAX_WIDTH) {
    throw new ExprError(`Literal width must be between 1 and ${MAX_WIDTH} bits.`, tok.start, tok.end);
  }
  const base = { b: 2, d: 10, h: 16, o: 8 }[sized[2].toLowerCase() as 'b' | 'd' | 'h' | 'o'];
  const digits = sized[3].replace(/_/g, '');
  const valid: RegExp = base === 2 ? /^[01]+$/ : base === 8 ? /^[0-7]+$/ : base === 10 ? /^\d+$/ : /^[0-9a-fA-F]+$/;
  if (!digits || !valid.test(digits)) {
    throw new ExprError(`Invalid digits for base-${base} literal.`, tok.start, tok.end);
  }
  const full = parseInt(digits, base);
  if (full > maskOf(size)) {
    throw new ExprError(`Value ${full} does not fit in ${size} bits.`, tok.start, tok.end);
  }
  return { type: 'num', value: full, size, sized: true, raw: tok.text, start: tok.start, end: tok.end };
}

const LEVELS: BinaryOp[][] = [
  ['||'],
  ['&&'],
  ['|'],
  ['^', '~^'],
  ['&'],
  ['==', '!='],
  ['<', '<=', '>', '>='],
  ['<<', '>>'],
  ['+', '-'],
  ['*'],
];

const UNARY_OPS: UnaryOp[] = ['-', '+', '~', '!', '&', '|', '^'];

export function parseExpression(src: string): Node {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (text: string) => peek().type === 'op' && peek().text === text;
  const expect = (text: string) => {
    const tok = peek();
    if (tok.type !== 'op' || tok.text !== text) {
      throw new ExprError(
        tok.type === 'eof' ? `Expected '${text}' before end of expression.` : `Expected '${text}' but found '${tok.text}'.`,
        tok.start,
        Math.max(tok.end, tok.start + 1),
      );
    }
    return next();
  };

  function parseTernary(): Node {
    const cond = parseBinary(0);
    if (!isOp('?')) return cond;
    next();
    const then = parseTernary();
    expect(':');
    const otherwise = parseTernary();
    return { type: 'ternary', cond, then, else: otherwise, start: cond.start, end: otherwise.end };
  }

  function parseBinary(level: number): Node {
    if (level >= LEVELS.length) return parseUnary();
    let left = parseBinary(level + 1);
    while (peek().type === 'op' && (LEVELS[level] as string[]).includes(peek().text)) {
      const op = next().text as BinaryOp;
      const right = parseBinary(level + 1);
      left = { type: 'binary', op, left, right, start: left.start, end: right.end };
    }
    return left;
  }

  function parseUnary(): Node {
    const tok = peek();
    if (tok.type === 'op' && (UNARY_OPS as string[]).includes(tok.text)) {
      next();
      const arg = parseUnary();
      return { type: 'unary', op: tok.text as UnaryOp, arg, start: tok.start, end: arg.end };
    }
    return parsePrimary();
  }

  function parseIndex(): number {
    const tok = next();
    if (tok.type !== 'num' || !/^\d+$/.test(tok.text)) {
      throw new ExprError('Bit indices must be plain decimal constants, e.g. v[7:6].', tok.start, Math.max(tok.end, tok.start + 1));
    }
    return Number(tok.text);
  }

  function parsePrimary(): Node {
    const tok = next();
    if (tok.type === 'num') return parseLiteral(tok);
    if (tok.type === 'ident') {
      if (!isOp('[')) return { type: 'ident', name: tok.text, start: tok.start, end: tok.end };
      next();
      const msb = parseIndex();
      let lsb = msb;
      if (isOp(':')) {
        next();
        lsb = parseIndex();
      }
      const close = expect(']');
      if (lsb > msb) throw new ExprError('Write ranges as [msb:lsb] with msb ≥ lsb.', tok.start, close.end);
      return { type: 'select', name: tok.text, msb, lsb, start: tok.start, end: close.end };
    }
    if (tok.type === 'op' && tok.text === '(') {
      const inner = parseTernary();
      const close = expect(')');
      return { ...inner, start: tok.start, end: close.end };
    }
    if (tok.type === 'op' && tok.text === '{') {
      if (peek().type === 'num' && tokens[pos + 1]?.text === '{') {
        throw new ExprError('Replication {n{...}} is not in the supported subset.', tok.start, tok.end);
      }
      const parts = [parseTernary()];
      while (isOp(',')) {
        next();
        parts.push(parseTernary());
      }
      const close = expect('}');
      return { type: 'concat', parts, start: tok.start, end: close.end };
    }
    if (tok.type === 'eof') throw new ExprError('Expression is incomplete.', tok.start, tok.start + 1);
    throw new ExprError(`Unexpected '${tok.text}'.`, tok.start, tok.end);
  }

  if (peek().type === 'eof') throw new ExprError('Expression is empty.', 0, 1);
  const root = parseTernary();
  const trailing = peek();
  if (trailing.type !== 'eof') {
    throw new ExprError(`Unexpected '${trailing.text}' after the end of the expression.`, trailing.start, trailing.end);
  }
  return root;
}
