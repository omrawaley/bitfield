import { Fragment, ReactNode } from 'react';

const KEYWORDS = new Set([
  'module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'logic', 'assign', 'always', 'begin', 'end',
  'if', 'else', 'posedge', 'negedge', 'parameter', 'localparam', 'case', 'endcase', 'default',
]);

const TOKEN = /(\/\/.*$)|(\d*'[bBdDhHoO][0-9a-fA-F_]+|\b\d[\d_]*\b)|([A-Za-z_][A-Za-z0-9_$]*)|(<=|>=|==|!=|<<|>>|&&|\|\||~\^|[-+*&|^~!<>=?:@#])|(\s+)|(.)/gm;

export function highlightVerilog(src: string, opts: { errorRange?: [number, number] } = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let key = 0;
  while ((m = TOKEN.exec(src))) {
    const text = m[0];
    const start = m.index;
    let cls = '';
    if (m[1]) cls = 'tk-com';
    else if (m[2]) cls = 'tk-num';
    else if (m[3]) cls = KEYWORDS.has(text) ? 'tk-kw' : 'tk-id';
    else if (m[4]) cls = 'tk-op';
    const err = opts.errorRange && start < opts.errorRange[1] && start + text.length > opts.errorRange[0];
    out.push(
      <span key={key++} className={`${cls}${err ? ' tk-err' : ''}`}>
        {text}
      </span>,
    );
  }
  return out;
}

export type CodeLine = string | { text: string; active?: boolean; slot?: ReactNode };

export function CodeView({ lines, label, startLine = 1 }: { lines: CodeLine[]; label: string; startLine?: number }) {
  return (
    <pre className="code" aria-label={label}>
      <code>
        {lines.map((line, i) => {
          const l = typeof line === 'string' ? { text: line } : line;
          return (
            <span key={i} className={`code-line ${l.active ? 'active' : ''}`}>
              <span className="code-ln" aria-hidden="true">
                {String(i + startLine).padStart(2, ' ')}
              </span>
              {l.slot ? (
                <Fragment>
                  {highlightVerilog(l.text.split('§')[0])}
                  {l.slot}
                  {highlightVerilog(l.text.split('§')[1] ?? '')}
                </Fragment>
              ) : (
                highlightVerilog(l.text)
              )}
              {'\n'}
            </span>
          );
        })}
      </code>
    </pre>
  );
}
