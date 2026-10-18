import { BitwiseExperiment } from './BitwiseExperiment';
import { PatternExperiment } from './PatternExperiment';
import './math.css';

const PRIMITIVES = [
  {
    sym: '(x, y)',
    name: 'Coordinates',
    text: 'While the monitor scans, two counters keep track of which pixel is being drawn: x from 0 to 639, y from 0 to 479.',
  },
  {
    sym: '1011',
    name: 'Binary',
    text: 'Each counter is a row of wires, one per bit. 10 bits are enough to count to 1023.',
  },
  {
    sym: '∧ ∨ ⊕ ¬',
    name: 'Boolean logic',
    text: 'AND, OR, XOR and NOT act on each bit position separately. Each one costs only a handful of transistors.',
  },
  {
    sym: '≪ + ×',
    name: 'Transforms',
    text: 'Shifts, adders, multipliers and comparators reshape the numbers. The result is cut down to a fixed number of bits.',
  },
];

export function MathSection() {
  return (
    <section id="mathematics" className="section" aria-labelledby="math-title">
      <div className="section-head">
        <div className="section-index">
          <b>01</b> / THE MATHEMATICS
        </div>
        <div>
          <h2 id="math-title" className="section-title">
            A picture is a function f(x, y)
          </h2>
          <p className="prose">
            The chip never stores an image. Sixty times a second, as the screen is scanned, the hardware takes the coordinates of the current pixel and runs them through a fixed circuit of binary operations. The number that comes out <em>is</em> the pixel’s colour. Change the arithmetic and you change the art.
          </p>
        </div>
      </div>

      <dl className="primitives">
        {PRIMITIVES.map((p) => (
          <div key={p.name} className="primitive">
            <dt>
              <span className="prim-sym">{p.sym}</span>
              <span className="label">{p.name}</span>
            </dt>
            <dd>{p.text}</dd>
          </div>
        ))}
      </dl>

      <div className="experiment">
        <div className="experiment-title">
          <span className="id">A</span>
          <h3>One operation, eight bits at a time</h3>
          <p>Every pixel formula is built from these operations.</p>
        </div>
        <BitwiseExperiment />
      </div>

      <div className="experiment">
        <div className="experiment-title">
          <span className="id">B · C</span>
          <h3>From a formula to a picture, and back to one pixel</h3>
          <p>Choose a formula, then click any pixel to follow its calculation step by step.</p>
        </div>
        <PatternExperiment />
      </div>
    </section>
  );
}
