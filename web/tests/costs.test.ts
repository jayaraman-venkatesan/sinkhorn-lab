import { describe, expect, it } from 'vitest';
import { distanceCosts } from '../src/scenario/costs';

describe('distance costs', () => {
  it('uses Euclidean costs without changing supplied quantities', () => {
    const a = [{ id: 'a', label: 'A', x: 0, y: 0, amount: 40 }];
    const b = [{ id: 'b', label: 'B', x: 3, y: 4, amount: 40 }];

    expect(distanceCosts(a, b)).toEqual([[5]]);
    expect(a[0]?.amount).toBe(40);
  });
});
