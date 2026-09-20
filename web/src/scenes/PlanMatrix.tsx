import type { DiagnosticNumber, Scenario } from '../contracts';
import { numberLabel } from './ResultSummary';
import type { RouteSelection } from './WarehouseScene';

export function PlanMatrix({ scenario, plan, selection, onSelect }: {
  scenario: Scenario; plan: DiagnosticNumber[][]; selection: RouteSelection;
  onSelect: (selection: RouteSelection) => void;
}) {
  const total = (values: DiagnosticNumber[]) => values.every((value) => typeof value === 'number')
    ? numberLabel((values as number[]).reduce((sum, value) => sum + value, 0)) : 'not finite';
  return <div className="table-scroll"><table aria-label="Transport plan">
    <caption>Transport plan · kg assigned per route</caption>
    <thead><tr><th scope="col">From / to</th>{scenario.targets.map((target) => <th scope="col" key={target.id}>{target.label}</th>)}<th scope="col">Row sum / supply</th></tr></thead>
    <tbody>{scenario.sources.map((source, i) => <tr key={source.id}>
      <th scope="row">{source.label}</th>
      {scenario.targets.map((target, j) => <td key={target.id}>
        <button type="button" className="matrix-cell" aria-label={`Plan ${source.label} to ${target.label}`}
          aria-pressed={selection?.sourceId === source.id && selection.targetId === target.id}
          onFocus={() => onSelect({ sourceId: source.id, targetId: target.id })}
          onMouseEnter={() => onSelect({ sourceId: source.id, targetId: target.id })}
          onClick={() => onSelect({ sourceId: source.id, targetId: target.id })}>
          {numberLabel(plan[i]![j]!)}<small>kg</small>
        </button>
      </td>)}
      <td>{total(plan[i]!)} / {numberLabel(source.amount)}</td>
    </tr>)}</tbody>
    <tfoot><tr><th scope="row">Column sum / demand</th>{scenario.targets.map((target, j) => <td key={target.id}>{total(plan.map((row) => row[j]!))} / {numberLabel(target.amount)}</td>)}<td>kg</td></tr></tfoot>
  </table></div>;
}
