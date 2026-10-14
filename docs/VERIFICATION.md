# CodeSentinel verification record

Verified locally on 12 October 2026 with Java 21 and Node 24. These checks describe the reviewed implementation and its stated boundary.

## Completed checks

- `CI=1 ./scripts/test.sh`: **90 JUnit/MockMvc tests**, zero failures, errors, or skips.
- Frontend production build passed.
- **16 Playwright Chromium cases** passed against the packaged Java application and built frontend, with managed fresh services.
- The documented demonstration passed **three times in fresh browser contexts**: real analysis, security/source highlighting, AST and symbols, converged data flow and the final unchanged round, original/optimized TAC, CFG selection/fit/zoom/reset, resources, and exact JSON export. Each rehearsal checked browser exceptions and console errors.
- Responsive cases cover 320/768/1440px, plus a 390px reduced-motion/data-flow case. Actual captures cover desktop, tablet, and mobile.
- Failure cases cover syntax/preprocessing recovery, excessive-expression API errors, unreadable backend responses, a 20-second client timeout, and stale/superseded results. The timeout test uses a controlled route and virtual browser clock; normal analysis tests use the real Java API.
- Educational cases cover source connections, typed instruction details, final iteration traces, tab keyboard navigation, editor escape, and 100-row token pagination on 2,250 tokens.
- All eight preserved vendor checksums passed with `shasum -a 256 -c SHA256SUMS`.

Backend tests independently check both fixed-point equations on a branch/loop CFG, both writes at joins, unreachable paths, uncertain memory writes, typed metadata after rewrites, and budget refusal. Reliability tests check volatile reads, unevaluated calls/releases, invalid targets, global errors, source ranges, qualified pointers, scansets, and return boundaries. Existing arithmetic, short-circuit, loop-target, redaction, parser-limit, scope, and API regressions remain covered.

## Rendering observation

A deterministic fixture with 150 simple functions produces 2,250 tokens. Before pagination, its token view rendered 2,250 table rows and 16,243 DOM nodes. After pagination, a local repeat rendered 100 rows and approximately 1,300 DOM nodes. All rows remain reachable through pagination. These observations establish a reduced rendering workload for this fixture, not a generalized speedup or C execution benchmark. Timing observations are intentionally not promoted to product claims.

## Demonstration evidence

The Full pipeline sample still has one function, 121 significant tokens, two security findings, zero resource warnings, and seven conservative TAC rewrites. Original and optimized streams each have 33 operational instructions. The application shows actual transformations; no instruction reduction or measured runtime gain is claimed.

Actual screenshots in `demo` were captured from the production UI and real local backend. `frontend/scripts/capture-review.mjs` reproduces the screenshots and stress observation. The Word guide was rendered and its page images visually reviewed. The Markdown faculty guide contains the three-minute script and honest examiner answers.

## Publication and boundaries

Before pushing, tracked/public files were checked for credential/private-key patterns, local environment files, private captures, and generated output. Deliberately fake teaching credential values remain in samples. GitHub Actions runs the same tests/build/production-browser checks and verifies parser checksums; failed runs retain test evidence. Its result must be checked for the final pushed commit, separately from local verification.

Submitted C is never executed or compiled into a binary. Chromium checks do not cover every browser engine or classroom machine. Full preprocessing/types, precise aliases/memory values, path/interprocedural proofs, DCE, and CSE remain unavailable. The client timeout does not guarantee server cancellation. Passing these tests is evidence for the tested behavior, not proof that every possible defect is absent.

## Beginner guide follow-up - 14 October 2026

The additive Start here guide passed the frontend production build and all **21 Playwright Chromium cases** against the packaged local Java backend. The original three demonstration rehearsals still pass. Five added cases check direct links to real compiler stages, backend-derived evidence, stale/loading/failed-result withholding, unavailable macro results, practice-answer feedback, focus, and 320/768/1440px layouts. Browser errors are asserted in the relevant cases. The failed-request case uses a controlled response; normal lesson analysis uses the real Java endpoint.

The guide uses the existing Arithmetic fixture and does not change backend algorithms. The earlier 90 backend checks are historical evidence; they were not rerun for this frontend/documentation change. The separate illustrated Class 5 introduction is rendered and visually reviewed. Classroom readability or learning effectiveness has not been evaluated with children.
