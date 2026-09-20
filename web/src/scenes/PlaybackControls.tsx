import type { PlaybackAction, PlaybackState } from '../playback/clock';
import type { SolveResponse } from '../contracts';

export function PlaybackControls({ state, result, dispatch, solverPlaying, onSolverPlay, onFrame, reducedMotion, onSolverReplay, panelId }: {
  state: PlaybackState; result: SolveResponse; dispatch: (action: PlaybackAction) => void;
  solverPlaying: boolean; onSolverPlay: (playing: boolean) => void; onFrame: (index: number) => void;
  reducedMotion: boolean;
  onSolverReplay: () => void; panelId: string;
}) {
  function play() {
    dispatch({ type: 'ShowShipment', checks: result.checks, elapsedMs: performance.now() });
    dispatch({ type: state.playing ? 'Pause' : 'Play', elapsedMs: performance.now() });
  }
  return <div className="playback-controls">
    {reducedMotion && <p className="message">Reduced motion: static steps replace continuous playback. All quantities and solver phases remain available.</p>}
    <div className="mode-tabs" role="tablist" aria-label="Playback mode" onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
      const current = tabs.findIndex((tab) => tab === document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next]?.focus();
      tabs[next]?.click();
    }}>
      <button type="button" role="tab" id={`${panelId}-Solver`} aria-controls={panelId} tabIndex={state.mode === 'Solver' ? 0 : -1} aria-selected={state.mode === 'Solver'} onClick={() => dispatch({ type: 'ShowSolver', elapsedMs: performance.now() })}>Solver</button>
      <button type="button" role="tab" id={`${panelId}-Shipment`} aria-controls={panelId} tabIndex={state.mode === 'Shipment' ? 0 : -1} aria-selected={state.mode === 'Shipment'} disabled={!result.checks.usable} onClick={() => dispatch({ type: 'ShowShipment', checks: result.checks, elapsedMs: performance.now() })}>Shipment</button>
    </div>
    {state.mode === 'Solver' && result.trace.frames.length > 0 && <>
      <div className="transport-actions">
        <button type="button" onClick={() => onSolverPlay(!solverPlaying)} disabled={reducedMotion || state.retainedFrameIndex === result.trace.frames.length - 1}>{solverPlaying ? 'Pause solver phases' : 'Play solver phases'}</button>
        <button type="button" className="quiet" disabled={state.retainedFrameIndex === 0} onClick={() => onFrame(state.retainedFrameIndex - 1)}>Previous phase</button>
        <button type="button" className="quiet" disabled={state.retainedFrameIndex === result.trace.frames.length - 1} onClick={() => onFrame(state.retainedFrameIndex + 1)}>Next phase</button>
        <button type="button" className="quiet" onClick={() => onFrame(0)}>Reset solver phases</button>
        <button type="button" className="quiet" disabled={reducedMotion} onClick={onSolverReplay}>Replay solver phases</button>
      </div>
      <label>Retained frame {state.retainedFrameIndex + 1} / {result.trace.frames.length}
        <input type="range" aria-label="Retained trace frame" min="0" max={result.trace.frames.length - 1} step="1" value={state.retainedFrameIndex} onChange={(event) => onFrame(Number(event.currentTarget.value))} />
      </label>
    </>}
    <div className="transport-actions">
      <button type="button" disabled={!result.checks.usable || reducedMotion} onClick={play}>{state.playing ? 'Pause shipments' : 'Play shipments'}</button>
      {state.mode === 'Shipment' && <>
        <button className="quiet" type="button" disabled={reducedMotion} onClick={() => dispatch({ type: 'Replay', elapsedMs: performance.now() })}>Replay shipments</button>
        <button className="quiet" type="button" onClick={() => {
          dispatch({ type: 'Pause', elapsedMs: performance.now() });
          dispatch({ type: 'ScrubShipment', progress: 0, elapsedMs: performance.now() });
        }}>Reset shipments</button>
        <button className="quiet" type="button" disabled={state.progress === 0} onClick={() => {
          dispatch({ type: 'Pause', elapsedMs: performance.now() });
          dispatch({ type: 'ScrubShipment', progress: Math.max(0, state.progress - 0.25), elapsedMs: performance.now() });
        }}>Previous shipment step</button>
        <button className="quiet" type="button" disabled={state.progress === 1} onClick={() => {
          dispatch({ type: 'Pause', elapsedMs: performance.now() });
          dispatch({ type: 'ScrubShipment', progress: Math.min(1, state.progress + 0.25), elapsedMs: performance.now() });
        }}>Next shipment step</button>
      </>}
      <label>Playback speed<select aria-label="Playback speed" value={state.speed} onChange={(event) => dispatch({ type: 'SetSpeed', speed: Number(event.currentTarget.value), elapsedMs: performance.now() })}>
        <option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option>
      </select></label>
    </div>
    {state.mode === 'Shipment' && <label>Shipment progress · {Math.round(state.progress * 100)}%
      <input type="range" aria-label="Shipment progress" min="0" max="1" step="0.01" value={state.progress} onChange={(event) => dispatch({ type: 'ScrubShipment', progress: Number(event.currentTarget.value), elapsedMs: performance.now() })} />
    </label>}
  </div>;
}
