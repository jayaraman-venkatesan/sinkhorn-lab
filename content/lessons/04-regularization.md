# Regularization and alternating scaling

Unregularized transport minimizes transport cost over feasible plans. The
Sinkhorn calculation taught here solves a changed problem: it adds an entropy
term that favors a more diffuse allocation. With the course's regularization
parameter $\varepsilon>0$, one common statement is

## Show the mathematics

$$
\min_{P\ge0}\ \langle P,C\rangle
+\varepsilon\sum_{i,j}P_{ij}(\log P_{ij}-1)
\quad\text{subject to }P\mathbf{1}=a,\ P^\mathsf{T}\mathbf{1}=b.
$$

Conventions differ by constants and sign, so always inspect a source's notation.
[Cuturi's 2013 paper](https://arxiv.org/pdf/1306.0895) uses an inverse parameter
$\lambda=1/\varepsilon$. Increasing
$\varepsilon$ makes spreading more influential; decreasing it emphasizes cost
more sharply and can make direct floating-point scaling difficult.

For the Basic solver, define $K_{ij}=\exp(-C_{ij}/\varepsilon)$ and materialize
$P=\operatorname{diag}(u)K\operatorname{diag}(v)$. Each update pair adjusts
destination scaling first, then source scaling. After the destination update,
column totals match their target in exact arithmetic; the following source
update restores rows and may disturb columns. The actual stopping check samples
the target residual at zero-based indices $0,10,20,\ldots$ and uses a strict
threshold comparison.

| Symbol | Linked meaning |
| --- | --- |
| [$a_i$ and $b_j$](01-problem.md) | Requested source and destination marginals |
| [$P_{ij}$](01-problem.md) | Tentative plan amount from source $i$ to destination $j$ |
| $C_{ij}$ | Per-unit route cost |
| $u_i$ and $v_j$ | Alternating source and destination scaling coordinates |

This alternating-scaling lineage is older than machine-learning OT; the
[Sinkhorn–Knopp 1967 paper](https://msp.org/pjm/1967/21-2/pjm-v21-n2-p14-s.pdf)
states the checked positive-matrix result and the qualifications for zeros.
The solver trace records those tentative states. No grain has shipped while the
numbers alternate. Shipment playback is a later view of a fixed, usable final
plan. Interpolated animation frames are not extra mathematical iterations.

## Static equivalent

For the pinned 100 kg rectangular trace, the first and final retained facts
explain the alternating constraints without animation. These values come from
the observed Basic snapshots in the [trace evidence](../../docs/research/paper-arxiv-1306-0895-sinkhorn-shift-lab/mass-trace-research.md),
not by rescaling the normalized result fixture.

| State | Row L1 error | Column L1 error | Meaning |
| --- | ---: | ---: | --- |
| After destination update, index 0 | 47.888986454621566 kg | 7.105427357601002e-15 kg | Columns enforced |
| After source update, index 0 | 7.105427357601002e-15 kg | 16.192103168735287 kg | Rows enforced; columns disturbed |
| After source update, index 30 | 3.552713678800501e-15 kg | 1.9806378759312793e-10 kg | Target residual is below the absolute threshold |

![Rectangular reference inputs and named solver outcomes](../figures/rectangular.svg)

The normalized [rectangular example and live solver scene](../examples/rectangular.json#solver-trace)
contains the separate exact pinned final result used by the figure. The trace
table above is checked directly against the 100 kg phase fixture; no browser
solver recomputes it.

Next: [compare numerical behavior](05-numerical-behavior.md).
