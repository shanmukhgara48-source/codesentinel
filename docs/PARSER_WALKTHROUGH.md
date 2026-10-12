# ANTLR C parser walkthrough

CodeSentinel uses an existing ANTLR Java-target C grammar to obtain genuine syntax recognition quickly. The application owns the educational AST, semantics, TAC, optimization, CFG, and analysis rules.

## Integrated grammar

ANTLR generator, Maven plugin, and Java runtime are all version **4.13.2**. `CLexer.g4`, `CParser.g4`, and Java support sources come from grammars-v4 commit **8c7680c4d28a2c84c8a1077a8b3dad4b37b300df**. Original files and checksums are in `backend/vendor/c`.

The snapshot’s README describes an updated C23 grammar with context-sensitive support. Some grammar headers retain earlier C11 ancestry wording. CodeSentinel claims a supported laboratory subset, not full C11/C23 compiler conformance. The grammar can recognize constructs whose semantics or TAC this workbench does not model.

`CParserBase` and its internal SymbolTable help distinguish identifiers that denote types from ordinary identifiers. Its semantic predicates support context-sensitive declarator/expression decisions. The application retains that support, seeds catalog `size_t`, and disables command-line/debug configuration. These parser-internal symbols serve grammar recognition only.

The original `CLexerBase` invokes a native preprocessor and writes files, including its non-preprocessing mode. Production `parser/generated/CLexerBase` is replaced with a small superclass constructor that directly accepts the CharStream. Request parsing has no file or subprocess integration.

## Source to token stream

`ParserAdapter.parse(source)` creates an `ANTLRInputStream`, `CLexer`, and `CommonTokenStream`. The UTF-16 stream deliberately aligns token offsets with JavaScript editor selection offsets. The adapter fills the token stream, checks the token/nesting limits, and projects inspectable tokens before parsing.

Comments and preprocessing directives remain on hidden channels. Significant tokens are channel zero and exclude whitespace, comments, directives, and EOF. The UI retains comment/directive records for inspection, so its inspectable count can exceed the significant headline count.

`lexer.getVocabulary()` supplies grammar token names. The application derives presentation categories such as KEYWORD, IDENTIFIER, LITERAL, STRING, OPERATOR, PUNCTUATION, COMMENT, and DIRECTIVE.

## Tokens to syntax and AST

`CParser.compilationUnit()` starts the grammar. The generated parser selects alternatives and invokes the pinned base’s disambiguation predicates. ANTLR creates a parse tree of rule contexts and terminals. A shared BaseErrorListener receives lexer/parser errors, retaining one-based line/column locations.

On a syntax failure, tokens and diagnostics are returned but AST and downstream passes are withheld. Parser recovery is used to collect errors; a recovered parse tree is not presented as a complete valid AST.

On success, `AstBuilder.build` explicitly traverses ParseTree children. The Maven plugin generates visitor interfaces, but CodeSentinel’s adapter uses a direct rule-context traversal rather than a custom generated visitor subclass. Wrapper/punctuation contexts collapse, and supported declarations/statements/expressions become application Nodes. Unsupported nodes preserve useful descendants and reasons.

## Worked example

```c
int calculate(void) { int a = 2 * 8 + 1; return a; }
```

Representative real lexer tokens are:

| Lexeme | Grammar token | Presentation category |
|---|---|---|
| `int` | Int | KEYWORD |
| `calculate` | Identifier | IDENTIFIER |
| `(` | LeftParen | PUNCTUATION |
| `2` | IntegerConstant | LITERAL |
| `*` | Star | OPERATOR |
| `return` | Return | KEYWORD |

Relevant grammar structure follows compilationUnit → translationUnit → externalDeclaration → functionDefinition → functionBody → compoundStatement. Block items contain a declaration and a jumpStatement. The initializer follows additiveExpression and multiplicativeExpression precedence rules, making multiplication bind more tightly than addition.

The simplified application tree is:

```text
TranslationUnit
└─ Function calculate (type int)
   └─ Block
      ├─ Declaration a (type int)
      │  └─ Binary +
      │     ├─ Binary *
      │     │  ├─ Literal 2
      │     │  └─ Literal 8
      │     └─ Literal 1
      └─ Return
         └─ Identifier a
```

`SymbolAnalyzer.visit` declares `a` before resolving the return’s identifier. `TacGenerator.expression` recursively lowers the Binary nodes to temporaries. React receives these application records; arbitrary ANTLR contexts never cross the API boundary.

## Header and unsupported boundaries

The four catalog includes are recognized as directives after parsing. `LibraryCatalog` models named library functions, `size_t`, and `NULL`; it does not expand headers or provide full library types. Other includes, defines, conditional compilation, and other preprocessing produce PP-UNSUPPORTED, with downstream stages skipped because preprocessing could change meaning.

Structs/unions, complex declarators, switch/goto, compiler extensions, and other unsupported constructs can be recognized by the grammar but are explicitly limited downstream. Simple fixed positive decimal array dimensions and pointer declarations are represented. General typedef/header-dependent semantic disambiguation and arbitrary preprocessing are outside the supported release.

Original grammar explanation: https://github.com/antlr/grammars-v4/tree/8c7680c4d28a2c84c8a1077a8b3dad4b37b300df/c
