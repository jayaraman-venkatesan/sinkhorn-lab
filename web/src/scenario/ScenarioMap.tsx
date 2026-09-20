import { useRef } from 'react';
import type { Scenario } from '../contracts';
import { updatePoint } from './model';

export function ScenarioMap({ scenario, onEdit }: { scenario: Scenario; onEdit: (scenario: Scenario) => void }) {
  const drag = useRef<{ clientX: number; clientY: number; x: number; y: number; scaleX: number; scaleY: number } | null>(null);
  const points = [...scenario.sources, ...scenario.targets];
  const minX = Math.min(0, ...points.map((point) => Number.isFinite(point.x) ? point.x : 0));
  const minY = Math.min(0, ...points.map((point) => Number.isFinite(point.y) ? point.y : 0));
  const extentX = Math.max(100, ...points.map((point) => Number.isFinite(point.x) ? point.x : 0)) - minX;
  const extentY = Math.max(100, ...points.map((point) => Number.isFinite(point.y) ? point.y : 0)) - minY;
  return <section className="scenario-map" aria-label="Edit map positions">
    <div className="scene-heading"><span>THE EXPERIMENT</span><span>{scenario.costMode === 'Distance' ? 'Straight-line distance · arbitrary map units' : 'Custom costs · moving points changes layout only'}</span></div>
    <svg viewBox="0 0 800 250" role="group" aria-label="Editable scenario map">
      {(['sources', 'targets'] as const).flatMap((collection) => scenario[collection].map((point) => (
        Number.isFinite(point.x) && Number.isFinite(point.y) ? <g key={point.id} transform={`translate(${40 + (point.x - minX) / extentX * 720} ${35 + (point.y - minY) / extentY * 160})`}
          className={`editable-point ${collection}`} role="button" tabIndex={0} aria-label={`Move ${point.label}`} aria-describedby="map-instructions"
          onPointerDown={(event) => {
            const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
            drag.current = { clientX: event.clientX, clientY: event.clientY, x: point.x, y: point.y, scaleX: extentX * 800 / (box.width * 720), scaleY: extentY * 250 / (box.height * 160) };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const start = drag.current;
            onEdit(updatePoint(scenario, collection, point.id, { x: start.x + (event.clientX - start.clientX) * start.scaleX, y: start.y + (event.clientY - start.clientY) * start.scaleY }));
          }}
          onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(event) => {
            const deltas: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            const delta = deltas[event.key];
            if (!delta) return;
            event.preventDefault();
            onEdit(updatePoint(scenario, collection, point.id, { x: point.x + delta[0], y: point.y + delta[1] }));
          }}>
          <circle r="17" /><path d="M-8 1H8M0-7V9" /><text textAnchor="middle" y="37">{point.label}</text>
        </g> : null
      )))}
    </svg>
    <p id="map-instructions">Drag a point, focus it and use arrow keys, or enter exact X/Y positions below. Moving a point clears the current result; Run remains explicit.</p>
  </section>;
}
