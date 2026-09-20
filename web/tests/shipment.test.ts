import { describe, expect, it } from 'vitest';
import { shipmentAt } from '../src/playback/shipment';

describe('shipment accounting', () => {
  it('derives every shipment quantity from one progress value', () => {
    const shipment = shipmentAt(
      [40, 60],
      [50, 50],
      [[1, 4], [3, 1]],
      [[40, 0], [10, 50]],
      0.5,
    );

    expect(shipment.sourceRemaining).toEqual([20, 30]);
    expect(shipment.targetReceived).toEqual([25, 25]);
    expect(shipment.targetRemaining).toEqual([25, 25]);
    expect(shipment.cost).toBe(60);
  });

  it.each([
    [0, [[0, 0], [0, 0]], [40, 60], [0, 0], [50, 50], 0],
    [0.25, [[10, 0], [2.5, 12.5]], [30, 45], [12.5, 12.5], [37.5, 37.5], 30],
    [1, [[40, 0], [10, 50]], [0, 0], [50, 50], [0, 0], 120],
  ] as const)(
    'computes the literal route state at progress %s',
    (progress, delivered, sourceRemaining, targetReceived, targetRemaining, cost) => {
      expect(shipmentAt(
        [40, 60],
        [50, 50],
        [[1, 4], [3, 1]],
        [[40, 0], [10, 50]],
        progress,
      )).toEqual({ delivered, sourceRemaining, targetReceived, targetRemaining, cost });
    },
  );

  it('clamps progress without rounding away a final solver residual', () => {
    const before = shipmentAt([1], [1], [[2]], [[0.999999999999]], -1);
    const after = shipmentAt([1], [1], [[2]], [[0.999999999999]], 2);

    expect(before).toEqual({
      delivered: [[0]],
      sourceRemaining: [1],
      targetReceived: [0],
      targetRemaining: [1],
      cost: 0,
    });
    expect(after.sourceRemaining[0]).toBeGreaterThan(0);
    expect(after.targetRemaining[0]).toBe(after.sourceRemaining[0]);
    expect(after.delivered).toEqual([[0.999999999999]]);
  });

  it('keeps zero-allocation routes in the delivered matrix', () => {
    expect(shipmentAt([3], [0, 3], [[7, 2]], [[0, 3]], 0.5)).toEqual({
      delivered: [[0, 1.5]],
      sourceRemaining: [1.5],
      targetReceived: [0, 1.5],
      targetRemaining: [0, 1.5],
      cost: 3,
    });
  });

  it.each([
    ['nonfinite progress', [1], [1], [[1]], [[1]], Number.NaN],
    ['a nonfinite plan entry', [1], [1], [[1]], [[Number.POSITIVE_INFINITY]], 0],
    ['a missing plan row', [1, 0], [1], [[1], [2]], [[1]], 0.5],
    ['a short plan row', [1], [0, 1], [[1, 2]], [[1]], 0.5],
    ['a missing cost row', [1], [1], [], [[1]], 0.5],
    ['a short cost row', [1], [0, 1], [[1]], [[0, 1]], 0.5],
  ])('rejects %s before shipment accounting', (_label, source, target, costs, plan, progress) => {
    expect(() => shipmentAt(source, target, costs, plan, progress)).toThrow();
  });
});
