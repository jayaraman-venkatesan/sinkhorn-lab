export type ShipmentState = {
  delivered: number[][];
  sourceRemaining: number[];
  targetRemaining: number[];
  targetReceived: number[];
  cost: number;
};

export function shipmentAt(
  source: number[],
  target: number[],
  costs: number[][],
  plan: number[][],
  progress: number,
): ShipmentState {
  if (!Number.isFinite(progress)) {
    throw new RangeError('Shipment progress must be finite.');
  }
  if (!hasShape(plan, source.length, target.length)) {
    throw new RangeError('The plan must match every source and destination.');
  }
  if (!hasShape(costs, source.length, target.length)) {
    throw new RangeError('The costs must match every source and destination.');
  }
  if (plan.some((row) => row.some((amount) => !Number.isFinite(amount)))) {
    throw new RangeError('The plan must contain only finite quantities.');
  }

  const p = Math.max(0, Math.min(1, progress));
  const delivered = plan.map((row) => row.map((amount) => p * amount));
  const sourceRemaining = source.map(
    (amount, index) => amount - delivered[index]!.reduce((sum, value) => sum + value, 0),
  );
  const targetReceived = target.map((_, targetIndex) =>
    delivered.reduce((sum, row) => sum + row[targetIndex]!, 0),
  );
  const targetRemaining = target.map(
    (amount, index) => amount - targetReceived[index]!,
  );
  const cost = delivered.reduce(
    (sum, row, sourceIndex) =>
      sum + row.reduce(
        (rowSum, amount, targetIndex) =>
          rowSum + amount * costs[sourceIndex]![targetIndex]!,
        0,
      ),
    0,
  );

  return { delivered, sourceRemaining, targetRemaining, targetReceived, cost };
}

function hasShape(matrix: number[][], rows: number, columns: number): boolean {
  return matrix.length === rows && matrix.every((row) => row.length === columns);
}
