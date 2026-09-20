import type { Point } from '../contracts';

export function distanceCosts(sources: Point[], targets: Point[]): number[][] {
  return sources.map((source) =>
    targets.map((target) => Math.hypot(target.x - source.x, target.y - source.y)),
  );
}
