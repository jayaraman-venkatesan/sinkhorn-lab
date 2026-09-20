import { describe, expect, it } from 'vitest';
import type { TraceFrame } from '../src/contracts';
import { describeTraceFrame, selectTraceFrame } from '../src/playback/trace';

const frames: TraceFrame[] = [
  frame(0, 'AfterDestination'),
  frame(10, 'AfterSource'),
  frame(11, 'AfterDestination', true),
  frame(11, 'Restored'),
];

describe('trace selection', () => {
  it('returns an actual retained endpoint without interpolating an iteration', () => {
    expect(selectTraceFrame(frames, 1)).toBe(frames[1]);
    expect(selectTraceFrame(frames, 1)).toMatchObject({ index: 10, phase: 'AfterSource' });
  });

  it('labels skipped solver indices and provisional phases', () => {
    expect(describeTraceFrame(frames, 1)).toEqual({
      iterationLabel: 'Iteration 10',
      phaseLabel: 'After source update',
      statusLabel: 'Provisional solver state',
      gapBefore: 'Iterations 1–9 omitted',
    });
  });

  it('labels rejected attempts and their restored state explicitly', () => {
    expect(describeTraceFrame(frames, 2)).toMatchObject({
      statusLabel: 'Rejected attempt',
      gapBefore: null,
    });
    expect(describeTraceFrame(frames, 3)).toMatchObject({
      phaseLabel: 'Restored state',
      statusLabel: 'Restored after rejection',
      gapBefore: null,
    });
  });

  it.each([-1, 0.5, frames.length])('rejects non-retained frame position %s', (index) => {
    expect(() => selectTraceFrame(frames, index)).toThrow(RangeError);
  });
});

function frame(
  index: number,
  phase: TraceFrame['phase'],
  rejected = false,
): TraceFrame {
  return {
    index,
    phase,
    solver: 'Basic',
    sourceScaling: [1],
    targetScaling: [1],
    isLog: false,
    rejected,
    plan: [[1]],
  };
}
