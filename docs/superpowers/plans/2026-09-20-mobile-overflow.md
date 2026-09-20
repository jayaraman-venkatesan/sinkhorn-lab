# Fix the CI mobile lesson overflow

Authority: user requested “Fix it” after the merged app failed CI. Preserve the
approved learning design and numerical contracts. Base: 334412f664e675c6f67ad55690f583ecdd5f3b6f.
No push, PR or merge approval is implied.

Latest authority (2026-09-20): after reviewing the one-pixel, Linux-only test
failure, the user explicitly approved deleting the simple overflow assertion
because this is not a production application. This supersedes the earlier strict
375px assertion requirement. Retain desktop/mobile rendering smoke coverage and
record the unresolved 376px observation honestly; do not claim a production
layout correction.

## Global constraints

Do not change production CSS, numerical behavior, or the library for this CI-only
follow-up. Remove only the user-approved brittle 375px page-width assertion while
retaining the real rendered course's desktop/mobile smoke and screenshots. Use an
isolated branch and independent review. No new application dependencies.

### Task 1: Retire the brittle mobile lesson overflow assertion

1. Record the merged CI failure in `web/e2e/lessons.spec.ts` at the
   manual-allocation chapter: scrollWidth376 with viewport375, plus the local
   environment comparison already completed before the authority changed.
2. Remove only the user-approved strict page-width assertion and make the mobile
   render readiness condition explicit.
3. Preserve the existing 375px viewport, desktop/mobile lesson smoke,
   interaction coverage and screenshots. Do not apply a production CSS workaround.
4. Run covering browser tests, full frontend tests/type/lint/build, content
   checks and full packaged browser acceptance. Record Linux/CI fidelity limits.
5. Commit the scoped correction and evidence. Controller independently reviews
   standards/spec and re-verifies before the separate follow-up PR approval gate.

Preflight: one test/documentation task, with no production or numerical change
and no competing writer. The latest user approval removes the earlier failing-
regression/root-cause implementation requirement. No conflicts identified.
