import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { BrowserDemoSimulator } from '../../simulator/browser-demo';
import type { ArtSimulator, SimulatorKind } from '../../simulator/simulator-interface';
import { SimulatorUnavailableError } from '../../simulator/simulator-interface';
import { VerilogSimulator } from '../../simulator/verilog-adapter';

export type SimStatus =
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string; checklist: string[] };

function create(kind: SimulatorKind): ArtSimulator {
  return kind === 'verilog' ? new VerilogSimulator() : new BrowserDemoSimulator();
}

export function useArtSimulator(initial: SimulatorKind) {
  const [kind, setKind] = useState<SimulatorKind>(initial);
  const [sim, setSim] = useState<ArtSimulator>(() => create(initial));
  const [status, setStatus] = useState<SimStatus>({ state: 'loading' });
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const simRef = useRef(sim);
  simRef.current = sim;

  useEffect(() => {
    let cancelled = false;
    const next = create(kind);
    setSim(next);
    setStatus({ state: 'loading' });
    const unsubscribe = next.subscribe(bump);
    next.load().then(
      () => !cancelled && setStatus({ state: 'ready' }),
      (e: unknown) => {
        if (cancelled) return;
        if (e instanceof SimulatorUnavailableError) setStatus({ state: 'error', message: e.message, checklist: e.checklist });
        else setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e), checklist: [] });
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
      next.dispose();
    };
  }, [kind]);

  const fail = useCallback((e: unknown) => {
    setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e), checklist: [] });
  }, []);

  return { kind, setKind, sim, simRef, status, version, fail };
}
