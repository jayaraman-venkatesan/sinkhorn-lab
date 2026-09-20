import { describe, expect, it } from 'vitest';
import type { TraceFrame } from '../src/contracts';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackAction,
  type PlaybackState,
} from '../src/playback/clock';

describe('playback clock', () => {
  it('advances shipment progress from an absolute clock anchor', () => {
    let state = shipmentState(100);
    state = reduce(state, { type: 'Play', elapsedMs: 100 });
    state = reduce(state, { type: 'Tick', elapsedMs: 600 });

    expect(state.progress).toBe(0.5);
    expect(state.anchorElapsedMs).toBe(100);
    expect(state.anchorProgress).toBe(0);
  });

  it('pauses and resumes from new absolute anchors without adding paused time', () => {
    let state = shipmentState(100);
    state = reduce(state, { type: 'Play', elapsedMs: 100 });
    state = reduce(state, { type: 'Pause', elapsedMs: 700 });
    expect(state).toMatchObject({
      progress: 0.6,
      playing: false,
      anchorElapsedMs: 700,
      anchorProgress: 0.6,
    });

    state = reduce(state, { type: 'Tick', elapsedMs: 900 });
    state = reduce(state, { type: 'Play', elapsedMs: 900 });
    state = reduce(state, { type: 'Tick', elapsedMs: 1100 });
    expect(state.progress).toBeCloseTo(0.8, 12);
  });

  it('scrubs backward and changes speed by preserving progress at the action time', () => {
    let state = shipmentState(0);
    state = reduce(state, { type: 'Play', elapsedMs: 0 });
    state = reduce(state, { type: 'Tick', elapsedMs: 500 });
    state = reduce(state, { type: 'ScrubShipment', progress: 0.25, elapsedMs: 500 });
    expect(state).toMatchObject({
      progress: 0.25,
      anchorElapsedMs: 500,
      anchorProgress: 0.25,
    });

    state = reduce(state, { type: 'Tick', elapsedMs: 600 });
    state = reduce(state, { type: 'SetSpeed', speed: 2, elapsedMs: 600 });
    state = reduce(state, { type: 'Tick', elapsedMs: 700 });
    expect(state.progress).toBeCloseTo(0.55, 12);
  });

  it('replays from zero and stops at the exact endpoint', () => {
    let state = { ...shipmentState(300), progress: 1, anchorProgress: 1 };
    state = reduce(state, { type: 'Replay', elapsedMs: 300 });
    expect(state).toMatchObject({
      progress: 0,
      playing: true,
      anchorElapsedMs: 300,
      anchorProgress: 0,
    });

    state = reduce(state, { type: 'Tick', elapsedMs: 1300 });
    expect(state).toMatchObject({ progress: 1, playing: false });
  });

  it('enters shipment mode only for a result whose checks are usable', () => {
    const solver = createPlaybackState(1000, 50);
    const blocked = reduce(solver, {
      type: 'ShowShipment',
      checks: { usable: false },
      elapsedMs: 75,
    });
    const allowed = reduce(solver, {
      type: 'ShowShipment',
      checks: { usable: true },
      elapsedMs: 75,
    });

    expect(blocked).toBe(solver);
    expect(allowed).toMatchObject({
      mode: 'Shipment',
      playing: false,
      anchorElapsedMs: 75,
      anchorProgress: 0,
    });
  });

  it('selects retained trace positions without changing shipment progress', () => {
    const frames = [frame(4, 'AfterDestination'), frame(4, 'AfterSource')];
    const state = { ...createPlaybackState(1000), progress: 0.375, anchorProgress: 0.375 };

    const selected = reduce(state, {
      type: 'SelectTraceFrame',
      frames,
      index: 1,
      elapsedMs: 20,
    });

    expect(selected).toMatchObject({
      retainedFrameIndex: 1,
      progress: 0.375,
      playing: false,
      anchorElapsedMs: 20,
      anchorProgress: 0.375,
    });
  });

  it.each([
    ['duration', () => createPlaybackState(0)],
    ['absolute time', () => createPlaybackState(1000, Number.NaN)],
    ['speed', () => reduce(shipmentState(0), { type: 'SetSpeed', speed: 0, elapsedMs: 0 })],
    ['scrub value', () => reduce(shipmentState(0), { type: 'ScrubShipment', progress: Number.NaN, elapsedMs: 0 })],
    ['backward clock', () => reduce(shipmentState(100), { type: 'Tick', elapsedMs: 99 })],
  ])('rejects an invalid %s', (_label, operation) => {
    expect(operation).toThrow(RangeError);
  });
});

function shipmentState(elapsedMs: number): PlaybackState {
  return reduce(createPlaybackState(1000, elapsedMs), {
    type: 'ShowShipment',
    checks: { usable: true },
    elapsedMs,
  });
}

function reduce(state: PlaybackState, action: PlaybackAction): PlaybackState {
  return playbackReducer(state, action);
}

function frame(index: number, phase: TraceFrame['phase']): TraceFrame {
  return {
    index,
    phase,
    solver: 'Basic',
    sourceScaling: [1],
    targetScaling: [1],
    isLog: false,
    rejected: false,
    plan: [[1]],
  };
}
