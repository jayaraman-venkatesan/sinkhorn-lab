import type { EditorAction, EditorState } from './model';

export function scenarioReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'Edit':
      return {
        ...state,
        scenario: action.scenario,
        revision: state.revision + 1,
        busy: false,
        requestId: null,
        results: {},
        transportError: null,
        stale: state.busy || Object.keys(state.results).length > 0,
      };
    case 'RunStarted':
      if (action.revision !== state.revision) return state;
      return {
        ...state,
        busy: true,
        requestId: action.requestId,
        results: {},
        transportError: null,
        stale: false,
      };
    case 'RunFinished':
      if (action.requestId !== state.requestId || action.revision !== state.revision) {
        return state;
      }
      return {
        ...state,
        busy: !action.isLast,
        requestId: action.isLast ? null : state.requestId,
        results: { ...state.results, [action.result.solver]: action.result },
      };
    case 'RunFailed':
      if (action.requestId !== state.requestId || action.revision !== state.revision) {
        return state;
      }
      return {
        ...state,
        busy: false,
        requestId: null,
        transportError: action.error,
      };
    case 'Cancel':
      return { ...state, busy: false, requestId: null };
  }
}
