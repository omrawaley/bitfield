import { useEffect, useState } from 'react';
import { project } from '../../data/project';
import './nav.css';

export const SECTIONS = [
  { id: 'experience', index: '00', label: 'Experience' },
  { id: 'layout', index: '00·B', label: 'Physical Layout' },
  { id: 'mathematics', index: '01', label: 'The Mathematics' },
  { id: 'verilog', index: '02', label: 'Verilog Lab' },
  { id: 'silicon', index: '03', label: 'Code → Silicon' },
];

export function scrollToSection(n: number) {
  const s = SECTIONS.find((x) => x.index === String(n).padStart(2, '0'));
  if (s) document.getElementById(s.id)?.scrollIntoView({ block: 'start' });
}

export function NavBar() {
  const [active, setActive] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(SECTIONS.findIndex((s) => s.id === e.target.id));
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <header className="nav">
      <a className="nav-brand" href="#experience" onClick={() => setActive(0)}>
        <span className="nav-mark" aria-hidden="true" />
        <span className="nav-name">{project.name}</span>
        <span className="nav-event">{project.event}</span>
      </a>
      <nav aria-label="Sections">
        <ol className="nav-links">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={active === i ? 'true' : undefined}>
                <span className="nav-idx">{s.index}</span>
                <span className="nav-label">{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="nav-tools">
        <button type="button" className="nav-btn" aria-expanded={helpOpen} aria-controls="shortcut-help" onClick={() => setHelpOpen((o) => !o)}>
          Keys <kbd>?</kbd>
        </button>
        {helpOpen && (
          <div id="shortcut-help" className="nav-help" role="dialog" aria-label="Keyboard shortcuts">
            <dl>
              <dt><kbd>0</kbd>–<kbd>3</kbd></dt><dd>jump to section</dd>
              <dt><kbd>␣</kbd></dt><dd>run / pause artwork</dd>
              <dt><kbd>R</kbd></dt><dd>restart</dd>
              <dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>previous / next pattern</dd>
              <dt><kbd>F</kbd></dt><dd>fullscreen artwork</dd>
              <dt><kbd>G</kbd></dt><dd>cycle grid overlay</dd>
              <dt><kbd>←↑→↓</kbd></dt><dd>move pixel probe (focus image)</dd>
              <dt><kbd>Esc</kbd></dt><dd>clear probe</dd>
            </dl>
          </div>
        )}
      </div>
      <SectionShortcuts onHelp={() => setHelpOpen((o) => !o)} />
    </header>
  );
}

function SectionShortcuts({ onHelp }: { onHelp: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-3]$/.test(e.key)) scrollToSection(Number(e.key));
      else if (e.key === '?') onHelp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp]);
  return null;
}
