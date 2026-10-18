import { describe, expect, it } from 'vitest';
import { ART_SYMBOLS, COLOR_MAPS, DEMO_PATTERNS, compileColorMap, getPattern } from '../pattern-generators';
import { ExprError } from './ast';
import { compileExpression, traceExpression, tryCompile } from './evaluate';

const ev = (src: string, env: Record<string, number>, lhs = 8) => compileExpression(src, ART_SYMBOLS, lhs).evaluate(env);

describe('Verilog width semantics', () => {
  it('truncates sums to the context width before a right shift', () => {
    expect(ev('(x + y) >> 4', { x: 1000, y: 1000 })).toBe(976 >> 4);
    expect(ev('(x + y + 0) >> 4', { x: 1000, y: 1000 })).toBe((2000 >> 4) & 255);
  });

  it('truncates products to the context width', () => {
    expect(ev('(x * y) >> 4', { x: 100, y: 100 })).toBe((10000 % 1024) >> 4);
    expect(ev('(x * y * 1) >> 4', { x: 100, y: 100 })).toBe((10000 >> 4) & 255);
  });

  it('evaluates shift amounts self-determined and shifts past the width to zero', () => {
    expect(ev('x << 12', { x: 5 })).toBe(0);
    expect(ev('x << s', { x: 3, s: 7 })).toBe((3 << 7) & 255);
    expect(ev('x >> (s + 4)', { x: 1023, s: 3 })).toBe(1023 >> 7);
  });

  it('applies bitwise NOT at the context width', () => {
    expect(ev('~x', { x: 5 })).toBe((1023 - 5) & 255);
    expect(ev('~s', { s: 5 })).toBe(~5 & 255);
  });

  it('wraps unsigned negation and subtraction', () => {
    expect(ev('-x', { x: 1 })).toBe(255);
    expect(ev('x - y', { x: 0, y: 1 })).toBe(255);
    expect(ev('(x - 320) * (x - 320)', { x: 0 }, 32)).toBe(102400);
  });

  it('handles comparisons, logic, ternaries, selects, concat and reductions', () => {
    expect(ev('x < y', { x: 3, y: 4 })).toBe(1);
    expect(ev('x == 640', { x: 640 })).toBe(1);
    expect(ev('x && 0', { x: 9 })).toBe(0);
    expect(ev('x > 5 ? k : t', { x: 6, k: 77, t: 3 })).toBe(77);
    expect(ev('{x[1:0], y[1:0]}', { x: 0b10, y: 0b01 })).toBe(0b1001);
    expect(ev('{4\'hA, 4\'h5}', {})).toBe(0xa5);
    expect(ev('&x[3:0]', { x: 0b1111 })).toBe(1);
    expect(ev('^x', { x: 0b111 })).toBe(1);
    expect(ev('x ~^ y', { x: 0, y: 0 })).toBe(255);
  });

  it('masks the result to the assignment width', () => {
    expect(ev('x', { x: 0x3ff })).toBe(0xff);
    expect(ev('x', { x: 0x3ff }, 10)).toBe(0x3ff);
  });
});

describe('parser errors', () => {
  const bad = ['', 'x +', '(x ^ y', 'x / 2', 'x % 3', 'foo', 'x[12]', 'x[1:3]', "4'b102", "3'd9", 'x ** 2', '{2{x}}', 'x y'];
  for (const src of bad) {
    it(`rejects ${JSON.stringify(src)}`, () => {
      const r = tryCompile(src, ART_SYMBOLS, 8);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(ExprError);
    });
  }
});

describe('compiled fast path matches the step-by-step trace', () => {
  const extra = [
    'x ^ y',
    'x & y',
    'x | y',
    '(x ^ y) + t',
    '(x >> s) ^ (y << s)',
    '{x[3:0], y[3:0]} - k',
    '(x > y) ? ~(x * y) : (x + k) >> s',
    '-(x ^ t) | &y[2:0]',
  ];
  const sources = [...DEMO_PATTERNS.map((p) => p.expr), ...extra];
  let seed = 1234567;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed % n;
  };
  for (const src of sources) {
    it(src, () => {
      const expr = compileExpression(src, ART_SYMBOLS, 8);
      for (let i = 0; i < 400; i++) {
        const env = { x: rand(640), y: rand(480), t: rand(256), s: rand(8), k: rand(256) };
        expect(traceExpression(expr, env).value).toBe(expr.evaluate(env));
      }
    });
  }

  it('frame renderer agrees with evaluate()', () => {
    const cm = compileColorMap(COLOR_MAPS[0]);
    for (const def of DEMO_PATTERNS) {
      const p = getPattern(def);
      const out = new Uint32Array(64 * 48);
      const params = { t: 17, s: def.defaults.s, k: 99 };
      p.render(out, 64, 48, 300, 200, params, cm.lut);
      for (const [px, py] of [[0, 0], [13, 7], [63, 47]]) {
        const v = p.expr.evaluate({ x: px + 300, y: py + 200, ...params });
        expect(out[py * 64 + px]).toBe(cm.lut[v]);
      }
    }
  });
});

describe('colour maps', () => {
  it('produce 2-bit channels', () => {
    for (const def of COLOR_MAPS) {
      const cm = compileColorMap(def);
      for (let v = 0; v < 256; v++) {
        for (const ch of [cm.r, cm.g, cm.b]) {
          const c = ch.evaluate({ v });
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(4);
        }
      }
    }
  });
});
