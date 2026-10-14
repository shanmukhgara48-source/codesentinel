# CodeSentinel: a first lesson

You can start without knowing C. Ask an adult or teammate to start the local app using the README. Open http://127.0.0.1:5173, then select **New to coding? Start here**. The button takes you to the guide, including on a small screen.

1. Select **Load tiny example**. It loads Arithmetic and replaces the editor's code. It does not run the program.
2. Select **Analyze this code**. Wait for the current report.
3. Try the nine ideas in order, using **Next idea** and **Back**. You can also choose a lesson directly.
4. Use **Open the real ... view** when you want to see the full result. Source buttons highlight the responsible line.
5. Finish with **Your turn**. Explain the story to a friend.

## The ideas

| Simple idea | Coding word | What it means |
|---|---|---|
| A recipe | Source code | Instructions written in C. The tool reads them without running them. |
| Little pieces | Tokens | Names, numbers, signs and punctuation. |
| A tree of parts | AST | The meaningful structure, including the order of a sum. |
| Named boxes | Variables and symbols | Names for storage, with different identities in different scopes. |
| Small steps | TAC | An intermediate list of explicit operations and temporary values. |
| Simpler calculations | Folding and propagation | Work out supported constant sums and carry known values to later uses. |
| Possible roads | CFG | Blocks and arrows showing choices, loops and returns. |
| Follow values | Data flow | Which values may be needed later, and which earlier writes may reach a read. |
| A part to check | Finding | A review pattern with evidence and limits; not proof of danger. |

## Use the little sum

Arithmetic starts with `2 * 8 + 1`, then adds 3. Explain multiplication first: 16, then 17, then 20. The report's optimized return becomes `return 20`. The tool does not run C to discover that answer. Both instruction lists keep six operational instructions; no instruction-removal pass is implemented.

## Keep teaching examples separate

The rain/umbrella picture and simple sums explain ideas. They are not analysis results from every submitted file. The guide labels them. Actual result cards identify names/functions from the current report. The fixed-point round counts come from completed data-flow results, not from running a program repeatedly.

When code changes, the guide hides the previous evidence and asks for analysis again. Loading and failed requests do the same. Unsupported syntax or features may leave a stage without a result. Missing means unavailable, not zero problems. A warning asks for a closer look; no findings does not prove safety.

This guide simplifies the explanation, not the algorithms. The single-file C and other analysis limits in ANALYSIS_LIMITATIONS still apply. This release has not been evaluated in a classroom or with children; readability is a design goal, not a measured learning outcome.
