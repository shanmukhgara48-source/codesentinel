# CodeSentinel review verification

Verified locally on 12 October 2026 with Java 21 and Node 24. This record describes the current checkout after the code review and fixes.

## Completed checks

- `CI=1 ./scripts/test.sh`: 73 JUnit/MockMvc backend tests passed with no failures, errors, or skips.
- Frontend production build passed.
- 11 Playwright Chromium cases passed against the actual Java backend, with managed fresh services.
- The exact demonstration journey passed three times in fresh browser contexts: analysis, findings/source highlighting, AST, symbols, unavailable data flow, actual TAC rewrites, CFG selection/zoom/reset, resources, and exact JSON export.
- Other browser cases cover syntax/preprocessing recovery, stale protection, superseded requests, upload/reset/dialogs/keyboard analysis, the new diagnostic categories, and layouts at 320/768/1440 pixels.
- `shasum -a 256 -c SHA256SUMS` passed for all eight preserved vendor files.
- Packaged startup and local API/browser smoke checks were performed after the full suite. The startup port guard refuses a second launch.

See [Code review and fixes](CODE_REVIEW.md) for the issues and regression coverage. The [product guide](PRODUCT_GUIDE.md) describes existing features in simple English.

## Evidence boundaries

Tests inspect structured results and the real frontend/API interaction. Submitted C fixtures are never executed or compiled into binaries. Local browser checks use Chromium, not all browser engines or classroom hardware. No hosted application deployment was performed.

The Full pipeline sample has one function, 121 significant tokens, two security findings, zero resource warnings, and seven conservative TAC rewrites. Original and optimized streams each have 33 operational instructions. No instruction-count reduction or measured runtime gain is claimed.

Syntax errors and unsupported preprocessing withhold downstream outputs. Live-variable analysis remains NOT_IMPLEMENTED. New depth limits return input errors for excessive expression trees. The intentionally unsafe fixtures are educational examples, not results from auditing an external project.

## Sharing assets

The demo directory contains actual desktop overview, diagnostics, control-flow, and mobile captures. The shareable Word product guide was rendered and its page images inspected. Render intermediates are excluded from Git. Source provenance and existing third-party notices remain preserved.

The GitHub workflow repeats the project verification after publication. Its hosted result is separate from the local checks above.
