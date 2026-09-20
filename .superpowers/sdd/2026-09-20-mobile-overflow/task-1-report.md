# Task 1 report: retire brittle mobile width assertion

## Authority and scope

Issue #8 tracks the merged CI failure. The initial task required preserving the
strict `scrollWidth <= 375` check and finding a production root cause. On
2026-09-20 the user explicitly changed that direction: it is acceptable to
delete this simple assertion because the project is not a production app.

The final change therefore removes only the environment-sensitive page-width
assertion. It keeps the desktop and 375px mobile navigation/rendering smoke,
visible mobile lesson heading, and screenshots. No production CSS, lesson
content, numerical code, dependencies, or viewport size changed.

## Observed failure and investigation

GitHub Actions runs `35538707276`, `35538707119`, and merged-main run
`35538859490` consistently reported the same failure in
`web/e2e/lessons.spec.ts`: the Ubuntu Chromium document had `scrollWidth` 376 at
a 375px viewport. The merged run otherwise passed 31 of 32 browser tests.

Exact CI evidence command:

```text
gh run view 35538859490 --log-failed

Expected: <= 375
Received:    376
at web/e2e/lessons.spec.ts:132:75
31 passed (32.9s)
```

A read-only macOS Playwright probe against the controller-owned packaged app at
`http://127.0.0.1:18086/lessons/02-manual-allocation` returned root and body
`scrollWidth` 375. Its manual-allocation table had contained horizontal overflow
inside the existing `.table-scroll` (`scrollWidth` 327, `clientWidth` 315), not
page overflow. Arial/Times and Liberation fallback probes also kept the page at
375px. These results establish environment sensitivity but do not identify the
Ubuntu element responsible for the extra pixel.

An isolated official Playwright 1.63 Ubuntu image was prepared for a matching
browser probe. Docker Desktop left newly created temporary containers in
`Created` state and blocked their starts while the controller-owned baseline
continued running. Per the updated scope, investigation stopped without changing
or restarting Docker. Two bounded removal attempts hit the same Docker control-
path block, leaving the task-owned `mobile-overflow-linux-browser` container in
`Created` (never-running, no ports) state. The controller container was untouched.

The root cause of the one-pixel Ubuntu measurement remains unresolved. This
change intentionally drops that guarantee under the latest user approval and
does not claim to fix layout overflow.

## Change

- Removed `document.documentElement.scrollWidth <= 375` from the combined
  desktop/mobile lesson screenshot test.
- Added a visible-heading assertion after the 375px mobile navigation so the
  test still waits for and verifies the mobile lesson render before capturing
  its screenshot.
- Updated the follow-up plan with the latest user authority and scope.

## Verification

All commands used the pinned runtime path required for this worktree.

```text
cd web && npm test -- --run
Test Files  7 passed (7)
Tests       85 passed (85)

cd web && npm run typecheck
exit 0

cd web && npm run lint
exit 0

cd web && npm run build
✓ built in 163ms

node scripts/verify-content.mjs
Content verification passed: 6 lessons.

cd web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:18086 \
  npm run test:packaged -- e2e/lessons.spec.ts
8 passed (4.1s)

cd web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:18086 \
  npm run test:packaged
32 passed (11.4s)
```

Browser verification used the unchanged, controller-owned packaged application
on port 18086. This was sufficient because the committed application/runtime
code is unchanged; Playwright consumed the revised tests from this worktree.
No fresh Linux browser run was completed because Docker Desktop blocked starts
of task-owned temporary containers. The three existing Ubuntu CI failures remain
the evidence for the retired assertion's environment-sensitive behavior.
