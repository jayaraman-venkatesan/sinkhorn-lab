import { shipmentAt } from '../playback/shipment';

export const manualSupply = [40, 60];
export const manualDemand = [50, 50];
export const manualCosts = [[1, 3], [2, 1]];

export type Allocation = { source: number; target: number; amount: number };

export type ManualAllocationState = {
  confirmed: Allocation[];
  preview: Allocation | null;
  error: string | null;
};

export type ManualAllocationAction =
  | { type: 'Preview'; allocation: Allocation }
  | { type: 'Confirm' }
  | { type: 'CancelPreview' }
  | { type: 'Undo' }
  | { type: 'Reset' };

export const initialManualAllocationState: ManualAllocationState = {
  confirmed: [],
  preview: null,
  error: null,
};

export function manualAllocationView(state: ManualAllocationState) {
  const plan = [[0, 0], [0, 0]];
  for (const allocation of state.confirmed) {
    plan[allocation.source]![allocation.target]! += allocation.amount;
  }
  return { plan, accounting: shipmentAt(manualSupply, manualDemand, manualCosts, plan, 1) };
}

export function manualAllocationLimit(state: ManualAllocationState, source: number, target: number): number {
  const { accounting } = manualAllocationView(state);
  return Math.max(0, Math.min(accounting.sourceRemaining[source] ?? 0, accounting.targetRemaining[target] ?? 0));
}

export function manualAllocationReducer(
  state: ManualAllocationState,
  action: ManualAllocationAction,
): ManualAllocationState {
  switch (action.type) {
    case 'Preview':
      if (!Number.isFinite(action.allocation.amount) || action.allocation.amount <= 0) {
        return { ...state, preview: null, error: 'Enter a positive finite allocation.' };
      }
      if (action.allocation.amount > manualAllocationLimit(state, action.allocation.source, action.allocation.target)) {
        return { ...state, preview: null, error: 'The allocation exceeds the remaining source or destination capacity.' };
      }
      return { ...state, preview: action.allocation, error: null };
    case 'CancelPreview':
      return { ...state, preview: null, error: null };
    case 'Confirm':
      return state.preview
        ? { confirmed: [...state.confirmed, state.preview], preview: null, error: null }
        : state;
    case 'Undo':
      return { confirmed: state.confirmed.slice(0, -1), preview: null, error: null };
    case 'Reset':
      return { ...initialManualAllocationState };
    default:
      return state;
  }
}
