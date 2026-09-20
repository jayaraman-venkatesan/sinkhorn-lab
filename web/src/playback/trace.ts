import type { TraceFrame } from '../contracts';

export type TraceFramePresentation = {
  iterationLabel: string;
  phaseLabel: string;
  statusLabel: string;
  gapBefore: string | null;
};

export function selectTraceFrame(frames: readonly TraceFrame[], index: number): TraceFrame {
  if (!Number.isInteger(index) || index < 0 || index >= frames.length) {
    throw new RangeError('The retained frame position is out of range.');
  }

  return frames[index]!;
}

export function describeTraceFrame(
  frames: readonly TraceFrame[],
  index: number,
): TraceFramePresentation {
  const frame = selectTraceFrame(frames, index);
  const previous = index > 0 ? selectTraceFrame(frames, index - 1) : undefined;
  const firstOmittedIndex = previous === undefined ? 0 : previous.index + 1;
  const lastOmittedIndex = frame.index - 1;
  const gapBefore = lastOmittedIndex >= firstOmittedIndex
    ? `Iterations ${firstOmittedIndex}–${lastOmittedIndex} omitted`
    : null;

  return {
    iterationLabel: `Iteration ${frame.index}`,
    phaseLabel: phaseLabel(frame.phase),
    statusLabel: frame.rejected
      ? 'Rejected attempt'
      : frame.phase === 'Restored'
        ? 'Restored after rejection'
        : frame.phase === 'Initial'
          ? 'Initial solver state'
          : 'Provisional solver state',
    gapBefore,
  };
}

function phaseLabel(phase: TraceFrame['phase']): string {
  switch (phase) {
    case 'Initial': return 'Initial state';
    case 'AfterDestination': return 'After destination update';
    case 'AfterSource': return 'After source update';
    case 'Restored': return 'Restored state';
  }
}
