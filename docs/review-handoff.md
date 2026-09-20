# App implementation review handoff

Evidence date: 2026-09-20. Implementation uses the approved six-ticket plan,
isolated `feat/sinkhorn-learning-app` worktree, sequential implementation agents,
task-level Specification and Standards review, and a final whole-branch review.
The library is pinned to merged commit
`5bc2a85fe1856fd9352af8cddca59d8ebda81d4d`.

## Review status

Final whole-branch review covered `cd80872..6d7c053`. It found no Critical defects
and two Important gaps: the shared mathematical lesson lacked alternating-update
equations, and enabled unselected mode tabs had insufficient hover contrast.
Two Minor improvements were retained: CI-wide startup readiness and a clock test
with a speed action between rendered ticks. A single consolidated fix wave at
`98c2dabb5d486c9f325cdf3560ebf5edf440f7c3` addressed all four. Independent scoped
re-review found all four addressed and no new breakage or remaining findings.
The mathematical lesson matches the pinned library's arithmetic, not just its
algebraic shorthand. Hover contrast is tested on actual solver-result tabs.

The controller independently passed 85 frontend tests, 26 API tests, all 32
browser tests against the rebuilt native container, type-check/lint/format,
Release build, six-lesson verification, four-figure drift checks and compiled
C# lesson usage. The production container build completed without the earlier
chunk warning. See the verification record for architecture-specific evidence.

## Rulings I made

These are controller process decisions, not additional product approvals.

1. Require compilable, runnable seams for behavioral RED evidence, rather than
   missing executables or compiler errors. If the seam is wrong, regression
   assurance can be weaker than it appears.
2. Rework affected APP-01 safeguards with observed behavioral RED/GREEN while
   retaining the original commit and its sequencing deviation. This costs rework
   and requires regression review to avoid losing safeguards.
3. Bring the already-approved Playwright tooling forward from APP-04 to APP-02
   for executable UI TDD, then reuse it. This costs earlier setup and risks
   duplicate configuration if not kept shared.
4. Rework affected APP-02 editor behavior from runnable seams with browser
   RED/GREEN, preserving the original history and disclosed deviation. This costs
   rework and regression checks around existing model/client contracts.
5. Rework affected APP-05 manual-allocation and content-verifier behavior from
   runnable seams with observed RED/GREEN, preserving the original commit and
   evidence. This costs rework and targeted regression review.

APP-01, APP-02 and APP-05 initially included implementation written before valid
behavioral RED evidence. Replacement work supplied observed RED/GREEN; it does
not retroactively make the original implementations test-first. A questioned
APP-03 grouped-RED finding was withdrawn by its reviewer, not waived by the
controller. Tests added to cover already-correct behavior are described as
coverage improvements, not invented product failures.

## Integration boundary

App code remains local. No app push, PR, merge, registry release, live hosting,
or new external service is authorized. The next human gate, after final checks,
is approval to push this feature branch and open a PR against `main` in
`jayaraman-venkatesan/sinkhorn-lab`. Merge/release authority is separate.
Keep the worktree and detailed ignored SDD evidence until integration is approved.

See [verification](verification.md) for commands, runtime evidence, screenshots,
and limitations. Native amd64 hardware, manual screen-reader certification,
Firefox/WebKit, remote app CI, and merged-app verification are not claimed.
Closed implementation tickets do not mean the project is shipped.
