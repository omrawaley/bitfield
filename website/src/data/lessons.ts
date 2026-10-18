export interface Lesson {
  id: string;
  index: string;
  title: string;
  goal: string;
  explain: string[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'gates',
    index: '01',
    title: 'Logic gates',
    goal: 'assign y = a ^ b;',
    explain: [
      '`assign` describes a permanent connection, not an instruction that runs once. Output `y` is always driven by the gate, so when `a` or `b` changes, `y` follows within a gate delay, a fraction of a nanosecond.',
      'Every pixel formula in our design ends up as a network of gates like this one, repeated across each bit.',
    ],
  },
  {
    id: 'shift',
    index: '02',
    title: 'Bit shifting',
    goal: 'wire [7:0] y = a << n;',
    explain: [
      'Shifting moves every bit sideways. A left shift by `n` multiplies by 2ⁿ, and bits that run off the top of the 8-bit wire are lost. A right shift by `n` divides by 2ⁿ and drops the low bits. Zeros fill the space left behind.',
      'Shifting by a constant needs no logic at all: the wires are simply connected n places over. Shifting by a variable amount needs a barrel shifter, which is three layers of multiplexers for an 8-bit value.',
    ],
  },
  {
    id: 'registers',
    index: '03',
    title: 'Registers and clocks',
    goal: 'always @(posedge clk) q <= d;',
    explain: [
      'A register (a bank of flip-flops) remembers a value. It ignores its input until the clock rises from 0 to 1. At that instant it samples `d` and holds it until the next rising edge.',
      'Try changing `d` without pressing the clock: `q` stays the same. A frame counter such as `t` is exactly this circuit wired as `q <= q + 1`, clocked once per frame.',
    ],
  },
  {
    id: 'pixels',
    index: '04',
    title: 'Pixel generation',
    goal: 'wire [7:0] v = f(x, y, t);',
    explain: [
      'This is where the earlier lessons come together. The VGA timing generator provides counters `x` and `y`, a register provides `t`, and a block of gates turns them into `v`. Type your own expression and the picture updates as you type.',
    ],
  },
];
