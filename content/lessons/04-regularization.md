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
$P=\operatorname{diag}(u)K\operatorname{diag}(v)$. With no warm start, Basic
initializes $u_i=1/n$ and $v_j=1/m$, where $n$ and $m$ count sources and
destinations. Each update pair performs these assignments in order.

First, update every destination using the current source coordinates:

$$
v_j = \frac{b_j}{\sum_i K_{ij}u_i}.
$$

Then update every source using the **new** destination coordinates:

$$
u_i = \frac{1}{\sum_j ((1/a_i)K_{ij})v_j}.
$$

Division, reciprocals, and the exponential defining $K$ act componentwise;
the sums are matrix-vector products, not matrix inverses. The source equation
shows the pinned C# Basic solver's arithmetic: it first constructs
$K'_{ij}=(1/a_i)K_{ij}$, then takes the reciprocal of each entry of $K'v$.
For positive $a_i$, this equals $u_i=a_i/(Kv)_i$ in exact arithmetic. Substituting
that latter expression can change floating-point and zero-source behavior;
it is not the implementation used here. The
[reference comparison](../../docs/research/paper-arxiv-1306-0895-sinkhorn-shift-lab/basic-solver-comparison.md)
explains this distinction and the separate LogDomain updates.

The column/row matching interpretation assumes these divisions are defined:
positive source masses and positive denominators, with finite arithmetic.
After the destination update, column totals then match their target in exact
arithmetic; the following source update restores rows and may disturb columns.
Zero masses are valid inputs, but a zero source makes $1/a_i$ nonfinite in
Basic. Kernel underflow or overflow can also spoil the updates. Basic checks
for zero destination denominators or nonfinite scaling after both phases,
rejects a failing pair, and restores its previous coordinates. Restoration does
not guarantee a usable plan. See [numerical behavior](05-numerical-behavior.md).

In the trace's **Solver coordinates** table, Basic's Sources column is $u$
(`sourceScaling`) and Destinations is $v$ (`targetScaling`). `AfterDestination`
keeps the preceding $u$ with the newly computed $v$; `AfterSource` contains both
new coordinates at the same zero-based update-pair index. A rejected trial and
its `Restored` state are labelled separately. LogDomain instead displays
$\alpha=\log u$ and $\beta=\log v$ in those columns, labelled Log-scaling;
its raw coordinates must not be read as Basic scaling values.

The actual stopping check samples the target residual after a full pair at
zero-based indices $0,10,20,\ldots$ and uses a strict threshold comparison.

| Symbol | Linked meaning |
| --- | --- |
| [$a_i$ and $b_j$](01-problem.md) | Requested source and destination marginals |
| [$P_{ij}$](01-problem.md) | Tentative plan amount from source $i$ to destination $j$ |
| $C_{ij}$ | Per-unit route cost |
| $K_{ij}$ and $K'_{ij}$ | Cost kernel and Basic's source-scaled kernel |
| $u_i$ and $v_j$ | Basic Sources and Destinations in the Solver coordinates table |
| $\alpha_i$ and $\beta_j$ | LogDomain Sources and Destinations, in log-scaling coordinates |

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
