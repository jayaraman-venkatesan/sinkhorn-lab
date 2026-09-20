# Build a feasible plan

A plan is built from commitments, not wishes. Choose one source–destination
cell, enter an amount, review it, and confirm it. A confirmation may use no more
than the source's remaining stock or the destination's remaining demand. Undo
removes the most recent commitment; reset removes every commitment.

The interactive scene below keeps one confirmed allocation matrix. Remaining
source, remaining demand, received grain, and accumulated cost all derive from
that matrix through the same shipment-accounting model used by final-plan
playback. Previewing an amount changes nothing. This distinction makes it safe
to explore a route before committing grain.

For costs $C=\begin{bmatrix}1&3\\2&1\end{bmatrix}$, two feasible plans can have
different transport costs. Feasibility tells us that all supply and demand are
accounted for; it does not say that the plan is cheapest.

## Static equivalent

| Feasible plan | A → A | A → B | B → A | B → B | Transport cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Direct-first | 40 kg | 0 kg | 10 kg | 50 kg | 110 |
| Cross-first | 0 kg | 40 kg | 50 kg | 10 kg | 230 |

Both plans use exactly 40 kg from Warehouse A, 60 kg from Warehouse B, and
deliver 50 kg to each destination. The first costs
$40(1)+10(2)+50(1)=110$; the second costs $40(3)+50(2)+10(1)=230$.
These are hand-checked feasible allocations, not invented Sinkhorn outputs.

![Balanced reference inputs and named solver outcomes](../figures/balanced.svg)

Try the [manual allocation scene](../examples/balanced.json#manual-allocation).
The pinned balanced JSON remains a separate regularized solver fixture. A
regularized plan spreads mass according to a different optimization objective;
the course never labels it the exact unregularized optimum.

Next: [place the method in its history](03-history.md).
