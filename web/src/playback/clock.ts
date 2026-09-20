import type { SolveChecks, TraceFrame } from '../contracts';
import { selectTraceFrame } from './trace';

export type PlaybackMode = 'Solver' | 'Shipment';

export type PlaybackState = {
  mode: PlaybackMode;
  progress: number;
  retainedFrameIndex: number;
  playing: boolean;
  speed: number;
  durationMs: number;
  anchorElapsedMs: number;
  anchorProgress: number;
  latestElapsedMs: number;
};

/**
 * Every `elapsedMs` is an absolute monotonic timestamp, such as the timestamp
 * supplied by requestAnimationFrame. It is never a delta from the prior tick.
 */
export type PlaybackAction =
  | { type: 'Play'; elapsedMs: number }
  | { type: 'Pause'; elapsedMs: number }
  | { type: 'Tick'; elapsedMs: number }
  | { type: 'ScrubShipment'; progress: number; elapsedMs: number }
  | { type: 'SetSpeed'; speed: number; elapsedMs: number }
  | { type: 'Replay'; elapsedMs: number }
  | { type: 'SelectTraceFrame'; frames: readonly TraceFrame[]; index: number; elapsedMs: number }
  | { type: 'ShowSolver'; elapsedMs: number }
  | { type: 'ShowShipment'; checks: Pick<SolveChecks, 'usable'>; elapsedMs: number };

export function createPlaybackState(durationMs: number, elapsedMs = 0): PlaybackState {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError('Playback duration must be a positive finite number of milliseconds.');
  }
  assertAbsoluteTime(elapsedMs, 0);

  return {
    mode: 'Solver',
    progress: 0,
    retainedFrameIndex: 0,
    playing: false,
    speed: 1,
    durationMs,
    anchorElapsedMs: elapsedMs,
    anchorProgress: 0,
    latestElapsedMs: elapsedMs,
  };
}

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  assertAbsoluteTime(action.elapsedMs, state.latestElapsedMs);

  switch (action.type) {
    case 'Play':
      return reanchor(state, action.elapsedMs, state.progress, state.progress < 1);
    case 'Pause': {
      const current = stateAt(state, action.elapsedMs);
      return reanchor(current, action.elapsedMs, current.progress, false);
    }
    case 'Tick':
      return stateAt(state, action.elapsedMs);
    case 'ScrubShipment': {
      if (!Number.isFinite(action.progress)) {
        throw new RangeError('Shipment progress must be finite.');
      }
      const progress = clampProgress(action.progress);
      return reanchor(state, action.elapsedMs, progress, state.playing && progress < 1);
    }
    case 'SetSpeed': {
      if (!Number.isFinite(action.speed) || action.speed <= 0) {
        throw new RangeError('Playback speed must be positive and finite.');
      }
      const current = stateAt(state, action.elapsedMs);
      return {
        ...reanchor(current, action.elapsedMs, current.progress, current.playing),
        speed: action.speed,
      };
    }
    case 'Replay':
      return reanchor(state, action.elapsedMs, 0, true);
    case 'SelectTraceFrame':
      selectTraceFrame(action.frames, action.index);
      return {
        ...reanchor(state, action.elapsedMs, state.progress, false),
        mode: 'Solver',
        retainedFrameIndex: action.index,
      };
    case 'ShowSolver': {
      const current = stateAt(state, action.elapsedMs);
      return {
        ...reanchor(current, action.elapsedMs, current.progress, false),
        mode: 'Solver',
      };
    }
    case 'ShowShipment':
      if (!action.checks.usable) {
        return { ...state, latestElapsedMs: action.elapsedMs };
      }
      return {
        ...reanchor(state, action.elapsedMs, state.progress, false),
        mode: 'Shipment',
      };
  }
}

function stateAt(state: PlaybackState, elapsedMs: number): PlaybackState {
  if (!state.playing) return { ...state, latestElapsedMs: elapsedMs };

  const progress = clampProgress(
    state.anchorProgress +
      ((elapsedMs - state.anchorElapsedMs) * state.speed) / state.durationMs,
  );
  if (progress < 1) return { ...state, progress, latestElapsedMs: elapsedMs };

  return reanchor(state, elapsedMs, 1, false);
}

function reanchor(
  state: PlaybackState,
  elapsedMs: number,
  progress: number,
  playing: boolean,
): PlaybackState {
  return {
    ...state,
    progress,
    playing,
    anchorElapsedMs: elapsedMs,
    anchorProgress: progress,
    latestElapsedMs: elapsedMs,
  };
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}

function assertAbsoluteTime(elapsedMs: number, minimumMs: number): void {
  if (!Number.isFinite(elapsedMs) || elapsedMs < minimumMs) {
    throw new RangeError('Absolute elapsed time must be finite and monotonic.');
  }
}
