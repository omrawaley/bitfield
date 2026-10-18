import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { LESSONS } from '../../data/lessons';
import { useGateLesson, useRegisterLesson, useShiftLesson } from './Lessons';
import { usePixelLesson } from './PixelLesson';
import './verilog-lab.css';

function richText(s: string): ReactNode[] {
  return s.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
}

export function VerilogLab() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const views = [useGateLesson(), useShiftLesson(), useRegisterLesson(), usePixelLesson(visible && active === 3)];
  const lesson = LESSONS[active];
  const view = views[active];

  const onTabKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => (a + 1) % LESSONS.length);
    else if (e.key === 'ArrowLeft') setActive((a) => (a - 1 + LESSONS.length) % LESSONS.length);
    else return;
    e.preventDefault();
  };

  return (
    <section id="verilog" className="section" aria-labelledby="verilog-title" ref={ref}>
      <div className="section-head">
        <div className="section-index">
          <b>02</b> / VERILOG LAB
        </div>
        <div>
          <h2 id="verilog-title" className="section-title">
            Describing hardware in code
          </h2>
          <p className="prose">
            Verilog is not a program that runs one line after another. It describes <strong>circuits</strong>: wires, gates and registers that all work at the same time. These four short lessons build up from a single gate to the kind of pixel logic our chip uses.
          </p>
        </div>
      </div>

      <div className="lab panel">
        <div className="lab-tabs" role="tablist" aria-label="Lessons" onKeyDown={onTabKey}>
          {LESSONS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              id={`lesson-tab-${l.id}`}
              aria-selected={active === i}
              aria-controls={`lesson-panel-${l.id}`}
              tabIndex={active === i ? 0 : -1}
              className={active === i ? 'on' : ''}
              onClick={() => setActive(i)}
            >
              <span className="lab-idx">{l.index}</span>
              <span className="lab-title">{l.title}</span>
              <code className="lab-goal">{l.goal}</code>
            </button>
          ))}
        </div>
        <div className="lab-body" role="tabpanel" id={`lesson-panel-${lesson.id}`} aria-labelledby={`lesson-tab-${lesson.id}`}>
          <div className="lab-left">
            <div className="lab-code">{view.code}</div>
            <div className="lab-explain">
              {lesson.explain.map((p, i) => (
                <p key={i}>{richText(p)}</p>
              ))}
            </div>
          </div>
          <div className="lab-right">{view.visual}</div>
        </div>
      </div>
    </section>
  );
}
