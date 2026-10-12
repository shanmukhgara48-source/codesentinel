# Parser provenance and third-party components

## Grammar snapshot

Original C grammar and Java support sources were retrieved from **antlr/grammars-v4**, commit **8c7680c4d28a2c84c8a1077a8b3dad4b37b300df**:

https://github.com/antlr/grammars-v4/tree/8c7680c4d28a2c84c8a1077a8b3dad4b37b300df/c

The originals are preserved in `backend/vendor/c`, with `SHA256SUMS`. CLexer.g4/CParser.g4 retain their upstream author/license notices (BSD-style conditions). The grammar files copied into `src/main/antlr4` are unchanged. Upstream Java support sources are retained for attribution and comparison.

## Local production adaptations

- Added Java package `com.codesentinel.parser.generated` to support classes.
- Replaced CLexerBase with direct CharStream construction. Removed native preprocessing, temporary source/output files, installed-header access, and command-line preprocessor settings from the production request path.
- Retained CParserBase context-sensitive disambiguation and parser-internal SymbolTable/Symbol/TypeClassification support.
- Removed command-line/debug configuration in CParserBase’s constructor; it always initializes the internal table for analysis. Added `size_t` as a catalog type seed.
- The educational symbol table, AST, semantic checks, TAC, optimization, CFG, metrics, findings, and scoring are application implementations, not claims about functionality supplied by the grammar.

Production request handling does not reference the untouched vendor lexer. Maven generates parser/lexer classes into target/generated-sources using ANTLR 4.13.2. The matching plugin/runtime versions are explicitly set in the POM.

## Library dependencies

Spring Boot, Jackson, ANTLR runtime, JUnit, React, Vite, Tailwind, CodeMirror 6 (MIT), Recharts, Lucide, Playwright, and Prettier are used under their upstream licenses. Dependency artifacts include their own notices. Npm versions/integrities are locked by `frontend/package-lock.json`; Maven dependency versions are supplied by the pinned Boot parent and explicit ANTLR version. No ownership claim is made over these libraries or upstream grammar/support sources.

## Verify source provenance

```bash
cd backend/vendor/c
shasum -a 256 -c SHA256SUMS
```

Use the preserved original and production files to inspect adaptations. The unsupported-preprocessing diagnostic is intentional: CodeSentinel does not silently approximate macro expansion with fabricated results.
