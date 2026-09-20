import type { DiagnosticNumber, Scenario } from '../contracts';
import type { ShipmentState } from '../playback/shipment';
import { numberLabel } from './ResultSummary';

export type RouteSelection = { sourceId: string; targetId: string } | null;

export function WarehouseScene({ scenario, plan, shipment, selection, onSelect, flowing, mode }: {
  scenario: Scenario; plan: DiagnosticNumber[][]; shipment: ShipmentState | null;
  selection: RouteSelection; onSelect: (selection: RouteSelection) => void; flowing: boolean;
  mode?: 'Plan' | 'Shipment' | 'Problem';
}) {
  const points = [...scenario.sources, ...scenario.targets];
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const extentX = Math.max(...points.map((point) => point.x)) - minX || 1;
  const extentY = Math.max(...points.map((point) => point.y)) - minY || 1;
  const position = (point: typeof points[number]) => ({ x: 120 + (point.x - minX) / extentX * 560, y: 110 + (point.y - minY) / extentY * 220 });
  const largest = Math.max(0, ...plan.flat().filter((value): value is number => typeof value === 'number' && value >= 0));

  const presentation = mode ?? (shipment ? 'Shipment' : 'Plan');
  return <div className={`warehouse-scene ${flowing ? 'flowing' : ''}`}>
    <div className="scene-heading"><span>{presentation === 'Problem' ? 'SUPPLY AND DEMAND' : presentation === 'Shipment' ? 'GRAIN IN TRANSIT' : 'A PLAN TAKES SHAPE'}</span><span>{presentation === 'Problem' ? 'Starting quantities · nothing shipped' : presentation === 'Shipment' ? 'Physical shipment' : 'Tentative · nothing shipped'}</span></div>
    <svg viewBox="0 0 800 460" role="group" aria-label="Warehouse transport map">
      <title>Grain moves along routes from warehouses to destinations</title>
      <path className="terrain" d="M0 385 Q170 300 350 380 T800 340 V460 H0Z" />
      <path className="terrain secondary" d="M0 410 Q200 360 420 410 T800 390" />
      {scenario.sources.flatMap((source, i) => scenario.targets.map((target, j) => {
        const start = position(source); const end = position(target);
        const dx = end.x - start.x; const dy = end.y - start.y;
        const curve = ((i + j) % 2 === 0 ? 1 : -1) * 0.16;
        const path = `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2 - dy * curve} ${(start.y + end.y) / 2 + dx * curve} ${end.x} ${end.y}`;
        const amount = plan[i]![j]!;
        const finite = typeof amount === 'number' && amount >= 0;
        const selected = selection?.sourceId === source.id && selection.targetId === target.id;
        const select = () => onSelect({ sourceId: source.id, targetId: target.id });
        const width = finite && largest > 0 ? amount / largest * 18 : 0;
        return <g key={`${source.id}-${target.id}`} className={`route ${selected ? 'selected' : ''}`}>
          <path d={path} className="route-guide" />
          {finite && amount > 0 && <path d={path} className="route-ribbon" strokeWidth={width} />}
          {finite && amount > 0 && <path d={path} className="route-spark" strokeWidth={Math.max(1, width * 0.25)} />}
          <path d={path} className="route-hit" tabIndex={0} role="button" aria-label={`Route ${source.label} to ${target.label}`} aria-pressed={selected}
            onFocus={select} onMouseEnter={select} onClick={select} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }}>
            <title>{source.label} → {target.label}: {numberLabel(amount)} kg</title>
          </path>
        </g>;
      }))}
      {(['sources', 'targets'] as const).flatMap((collection) => scenario[collection].map((point, index) => {
        const { x, y } = position(point);
        const source = collection === 'sources';
        const value = shipment ? (source ? shipment.sourceRemaining[index]! : shipment.targetReceived[index]!) : point.amount;
        const fill = point.amount > 0 ? Math.max(0, Math.min(1, value / point.amount)) : 0;
        const selected = source ? selection?.sourceId === point.id : selection?.targetId === point.id;
        return <g key={point.id} className={`map-node ${source ? 'source' : 'target'} ${selected ? 'selected' : ''}`} transform={`translate(${x} ${y})`}>
          <ellipse className="node-shadow" cy="36" rx="50" ry="12" />
          <rect className="silo" x="-27" y="-31" width="54" height="64" rx="6" />
          <rect className="grain-fill" x="-23" y={29 - fill * 56} width="46" height={fill * 56} rx="3" />
          <path className="silo-roof" d="M-32 -31 L0 -51 L32 -31Z" />
          <path className="silo-line" d="M-18 -18H18 M-18 -3H18 M-18 12H18" />
          <text className="node-name" textAnchor="middle" y="64">{point.label}</text>
          <text className="node-amount" textAnchor="middle" y="85">{numberLabel(value)} kg</text>
          <text className="node-kind" textAnchor="middle" y="-63">{source ? 'WAREHOUSE' : 'DESTINATION'}</text>
        </g>;
      }))}
    </svg>
    <p className="route-legend"><span className="legend-stroke" /> Ribbon width ∝ assigned kg. Widest = {numberLabel(largest)} kg. Dotted paths mark route geometry; moving highlights are decorative.</p>
    {shipment && <div className="inventory-grid">
      {scenario.sources.map((point, i) => <div key={point.id}><span>{point.label} remaining</span><strong aria-label={`${point.label} remaining`}>{numberLabel(shipment.sourceRemaining[i]!)} kg</strong></div>)}
      {scenario.targets.map((point, i) => <div key={point.id}><span>{point.label} received</span><strong aria-label={`${point.label} received`}>{numberLabel(shipment.targetReceived[i]!)} kg</strong><small>Unmet: {numberLabel(shipment.targetRemaining[i]!)} kg</small></div>)}
    </div>}
  </div>;
}
