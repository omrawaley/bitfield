import { project } from '../../data/project';
import './footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="label">Project</div>
          <p>
            {project.name} · {project.event}
          </p>
          {project.team.length > 0 ? <p className="footer-dim">{project.team.join(' · ')}</p> : <p className="footer-dim dev-only">Team names: add them in src/data/project.ts</p>}
          {project.links.repository && (
            <p>
              <a href={project.links.repository}>Source repository ↗</a>
            </p>
          )}
        </div>
        <div>
          <div className="label">What is real on this page</div>
          <ul>
            <li>
              <span className="badge demo">Reference demo</span> formulas evaluated in JavaScript, not our hardware
            </li>
            <li>
              <span className="badge hw">Verilog sim</span> pixels decoded from our design’s output pins
            </li>
            <li>
              <span className="badge muted">Illustration</span> teaching diagrams, not our layout
            </li>
          </ul>
        </div>
        <div>
          <div className="label">Acknowledgements</div>
          <p className="footer-dim">
            Pin conventions and simulator architecture studied from the{' '}
            <a href="https://github.com/TinyTapeout/vga-playground">Tiny Tapeout VGA Playground</a> (GPL-3.0; no code copied). Type: JetBrains Mono and IBM Plex Sans (SIL OFL).
          </p>
        </div>
      </div>
    </footer>
  );
}
