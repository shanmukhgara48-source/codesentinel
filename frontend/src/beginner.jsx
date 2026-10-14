import React from "react";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { button } from "./ui";

const lessons = [
  [
    "The recipe",
    "Code is a set of instructions",
    "A recipe tells a cook what to do. Code tells a computer what to do. CodeSentinel reads C code and helps us look at its parts. It does not run the recipe.",
  ],
  [
    "Little pieces",
    "First, find the little pieces",
    "Think of words and punctuation in a sentence. Code has pieces too: names, numbers and signs. The coding word for these pieces is tokens.",
  ],
  [
    "The tree",
    "Next, put the pieces in order",
    "A family tree shows connections. A code tree shows which parts belong together. Its coding name is AST: abstract syntax tree.",
  ],
  [
    "Named boxes",
    "Names help us keep track",
    "Imagine boxes with name labels. A variable is a name for a place that holds a value. A symbol table keeps track of these names and where they belong.",
  ],
  [
    "Small steps",
    "Break a big job into small steps",
    "We can split a big sum into small calculations. The coding name for this list is TAC: three-address code. Optimization can make supported calculations simpler.",
  ],
  [
    "The road map",
    "Choices make different roads",
    "At an if, the program has a choice. A loop lets it go around again. A control-flow graph, or CFG, maps these possible roads. It is not a recording of a program running.",
  ],
  [
    "Follow values",
    "Which values do we need?",
    "Imagine passing notes along the roads. Live variables asks which values might be needed later. Reaching definitions asks which earlier writes might have supplied a value.",
  ],
  [
    "Things to check",
    "A warning says: take a closer look",
    "A warning is like a teacher pointing to work to check. It explains a pattern in the code. It does not prove that the whole program is unsafe.",
  ],
  [
    "Your turn",
    "Tell the story in your own words",
    "You do not need to remember every coding word. Start with the idea, then match it to the real view when you feel ready.",
  ],
];
const hints = {
  Tokens: "Little pieces: names, numbers and signs in your code.",
  AST: "The code tree: see which parts belong together.",
  Symbols: "Named boxes: find each name and where it belongs.",
  Semantics: "Meaning checks: was a name introduced before it was used?",
  "TAC & optimization":
    "Small steps: compare original calculations with simpler ones.",
  "Data flow":
    "Follow values: which values may be needed, and which writes may reach a read?",
};
export function StageHint({ stage }) {
  return hints[stage] ? (
    <p className="mb-4 rounded-xl bg-[#F7F5FF] px-4 py-3 text-sm leading-6 text-[#514367]">
      {hints[stage]}
    </p>
  ) : null;
}
function Example({ children }) {
  return (
    <div className="rounded-2xl border border-[#E6E0F0] bg-[#FAF8FF] p-4">
      <p className="mb-3 text-xs font-semibold text-[#6534CC]">
        Teaching example, not a result from your file
      </p>
      {children}
    </div>
  );
}
function TreePicture() {
  return (
    <Example>
      <div className="text-center text-sm">
        <p className="mx-auto w-fit rounded-xl bg-white px-5 py-3">add +</p>
        <p className="my-2 text-[#7947FF]" aria-hidden="true">
          ↙　　↘
        </p>
        <div className="flex justify-center gap-3">
          <p className="rounded-xl bg-white px-3 py-3">multiply: 2 × 8</p>
          <p className="rounded-xl bg-white px-4 py-3">1</p>
        </div>
        <p className="mt-4 leading-6">
          Do 2 × 8 first. Then add 1. The tree keeps that order.
        </p>
      </div>
    </Example>
  );
}
function RoadPicture() {
  return (
    <Example>
      <div className="text-center text-sm">
        <p className="mx-auto w-fit rounded-xl bg-white px-4 py-3">
          Is it raining?
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <p className="rounded-xl bg-white p-3">
            Yes ↓<br />
            Take an umbrella
          </p>
          <p className="rounded-xl bg-white p-3">
            No ↓<br />
            Leave it at home
          </p>
        </div>
        <p className="mt-3 leading-6">
          Two possible roads. The map does not tell us today's weather.
        </p>
      </div>
    </Example>
  );
}
export default function BeginnerGuide({
  step,
  setStep,
  answer,
  setAnswer,
  result,
  stale,
  loading,
  error,
  onLoadExample,
  canLoadExample,
  onAnalyze,
  canAnalyze,
  onNavigate,
  onLocation,
}) {
  const [label, title, explanation] = lessons[step];
  // Lessons must not present an old or failed request as current evidence.
  const current = result && !stale && !loading && !error ? result : null;
  const modules = current?.modules || {};
  const tokens = (modules.tokens?.data || [])
    .filter((t) => !["COMMENT", "DIRECTIVE"].includes(t.category))
    .slice(0, 12);
  const symbols = (modules.symbols?.data?.symbols || [])
    .filter(
      (s) =>
        s.origin !== "LIBRARY" &&
        ["VARIABLE", "PARAMETER"].includes(s.category),
    )
    .slice(0, 6);
  const fn = modules.tac?.data?.find((f) => f.instructions?.length);
  const instructions =
    fn?.instructions
      .filter((i) => !["DECLARE", "LABEL"].includes(i.op))
      .slice(0, 4) || [];
  const flows = (modules.dataFlow?.data || []).filter(
    (f) => f.liveVariables?.converged && f.reachingDefinitions?.converged,
  );
  const findings = current?.findings || [];
  function open(section, stage) {
    return (
      <button
        className={`${button} mt-4 max-w-full`}
        disabled={!current}
        onClick={() => onNavigate(section, stage)}
      >
        Open the real {stage || section} view <ArrowRight size={14} />
      </button>
    );
  }
  function unavailable(module) {
    return (
      <p className="rounded-xl bg-[#F3F4F6] p-3 text-sm leading-6">
        No result for this part yet.{" "}
        {module?.limitations?.[0] || "Analyze a supported example to see it."}
      </p>
    );
  }
  return (
    <div className="space-y-5" aria-label="Easy learning guide">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-[#F0EAFF] p-2.5 text-[#7947FF]">
          <BookOpen size={20} />
        </span>
        <div>
          <h2 className="text-xl tracking-tight">
            Start small. Follow the story.
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#596171]">
            No coding experience needed. Try one idea at a time.
          </p>
        </div>
      </div>
      <div className="rounded-2xl bg-[#F5F5F7] p-4 text-sm leading-6">
        <p>
          For a short first lesson, load the tiny example. This replaces the
          code in the editor; it does not run it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={button}
            disabled={!canLoadExample || loading}
            onClick={onLoadExample}
          >
            Load tiny example
          </button>
          <button
            className={button}
            disabled={!canAnalyze || loading}
            onClick={onAnalyze}
          >
            {loading ? "Reading your code…" : "Analyze this code"}
          </button>
        </div>
        <p role="status" className="mt-3 text-xs leading-5 text-[#596171]">
          {loading
            ? "Reading the current file. Wait for its results."
            : error
              ? "The request did not finish. Check the message above, then try again. Previous results are hidden here."
              : stale
                ? "You changed the recipe. Analyze again before using its results."
                : !current
                  ? "The examples below teach the ideas. Your file's results appear after Analyze."
                  : `Now reading the report for ${current.sourceMetadata.filename}.`}
        </p>
      </div>
      <nav aria-label="Easy lesson steps">
        <ol className="flex flex-wrap gap-2">
          {lessons.map(([name], i) => (
            <li key={name}>
              <button
                onClick={() => setStep(i)}
                aria-current={step === i ? "step" : undefined}
                className={`rounded-full px-3 py-2 text-xs ${step === i ? "bg-[#080B10] text-white" : "bg-[#F3F4F6] text-[#444B59] hover:bg-[#F0EAFF]"}`}
              >
                {i + 1}. {name}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <section
        aria-labelledby="easy-lesson-title"
        className="space-y-4 text-sm leading-7 text-[#444B59]"
      >
        <p className="text-xs font-semibold text-[#6534CC]">
          Lesson {step + 1} of {lessons.length} · {label}
        </p>
        <h3
          id="easy-lesson-title"
          aria-live="polite"
          className="text-lg font-semibold text-[#080B10]"
        >
          {title}
        </h3>
        <p>{explanation}</p>
        {step === 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <p className="rounded-xl bg-[#F0EAFF] p-3">
                Read
                <br />
                <strong>the code</strong>
              </p>
              <p className="rounded-xl bg-[#F0EAFF] p-3">
                See
                <br />
                <strong>its parts</strong>
              </p>
              <p className="rounded-xl bg-[#F0EAFF] p-3">
                Explain
                <br />
                <strong>your idea</strong>
              </p>
            </div>
            <p>
              A function is a little job with a name. A return gives a value
              back. The tiny example has one job called calculate.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <Example>
              <code>int a = 2 * 8 + 1;</code>
              <p className="mt-3">
                Here, a is a name, 2 is a number, and + means add. The ; sign
                marks the end of this instruction.
              </p>
            </Example>
            {current &&
              (modules.tokens?.data ? (
                <div>
                  <h4 className="mb-2 font-semibold">
                    First pieces from your file
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {tokens.map((t) => (
                      <button
                        key={t.id}
                        className="max-w-full break-all rounded-lg bg-[#F0EAFF] px-3 py-2 font-mono text-xs text-[#6534CC]"
                        onClick={() => onLocation(t.range)}
                        title={`Line ${t.range.line}: ${t.category}`}
                      >
                        {t.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                unavailable(modules.tokens)
              ))}
            {open("Compiler", "Tokens")}
          </>
        )}
        {step === 2 && (
          <>
            <TreePicture />
            {open("Compiler", "AST")}
          </>
        )}
        {step === 3 && (
          <>
            <Example>
              <p>
                Two classrooms may both have a box called pencils. The classroom
                label tells us which box we mean. Scope is the coding word for
                where a name belongs.
              </p>
            </Example>
            {current &&
              (modules.symbols?.data ? (
                <div>
                  <h4 className="font-semibold">Names from your file</h4>
                  <ul className="mt-2 space-y-2">
                    {symbols.map((s) => (
                      <li
                        key={s.id}
                        className="break-words rounded-lg bg-[#F5F5F7] p-3"
                      >
                        <strong>{s.name}</strong> · identity {s.id}
                        <br />
                        <span className="text-xs text-[#596171]">
                          Belongs to {s.scope}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!symbols.length && (
                    <p>
                      No variable or parameter names were published for this
                      file.
                    </p>
                  )}
                </div>
              ) : (
                unavailable(modules.symbols)
              ))}
            {open("Compiler", "Symbols")}
          </>
        )}
        {step === 4 && (
          <>
            <Example>
              <div className="font-mono">
                <p>2 × 8 = 16</p>
                <p>16 + 1 = 17</p>
                <p>17 + 3 = 20</p>
              </div>
              <p className="mt-3">
                Folding works out a sum. Propagation carries a known value to
                the next step.
              </p>
            </Example>
            {current && (
              <div>
                <h4 className="mb-2 font-semibold">
                  {fn
                    ? `First steps from ${fn.name}`
                    : "No small-step result for this file"}
                </h4>
                {instructions.length ? (
                  <ul className="space-y-2">
                    {instructions.map((i) => (
                      <li key={i.id}>
                        <button
                          className="w-full break-all rounded-lg bg-[#F5F5F7] p-3 text-left font-mono text-xs leading-6"
                          onClick={() => onLocation(i.range)}
                        >
                          {i.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    This file's instructions are unavailable. Read the reason in
                    the detailed view.
                  </p>
                )}
              </div>
            )}
            {open("Optimization")}
          </>
        )}
        {step === 5 && (
          <>
            <RoadPicture />
            <p>
              Each box on the real map is a group of steps. Arrows show where
              the program could go next. A loop's arrow goes back to try again.
            </p>
            {open("Control flow")}
          </>
        )}
        {step === 6 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#FAF8FF] p-4">
                <strong>Looking ahead</strong>
                <p>
                  Keep a number if a later step may need it. This is the idea of
                  live variables.
                </p>
              </div>
              <div className="rounded-xl bg-[#FAF8FF] p-4">
                <strong>Looking behind</strong>
                <p>
                  One road writes x = 1; another writes x = 2. Both writes may
                  reach a later read.
                </p>
              </div>
            </div>
            <p>
              The tool checks these sets again and again. When one more round
              changes nothing, the sets have settled. The coding name is a fixed
              point. These are checks, not runs of your C program.
            </p>
            {current &&
              (flows.length ? (
                <ul className="space-y-2">
                  {flows.map((f) => (
                    <li
                      key={f.functionId}
                      className="break-words rounded-xl bg-[#F5F5F7] p-3"
                    >
                      <strong>{f.functionName}</strong>: live-variable sets
                      settled in {f.liveVariables.rounds} rounds;
                      reaching-definition sets settled in{" "}
                      {f.reachingDefinitions.rounds} rounds.
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No complete value-following result is available for this file.
                  The detailed view explains its coverage.
                </p>
              ))}
            {open("Compiler", "Data flow")}
          </>
        )}
        {step === 7 && (
          <>
            <Example>
              <p>
                A box has limited space, but an input operation has no length
                limit. The tool can point out the missing limit; it cannot know
                every possible input.
              </p>
            </Example>
            {current && (
              <div>
                <h4 className="mb-2 font-semibold">
                  Things to review in your file
                </h4>
                {current.summary.riskScore == null ? (
                  <p>
                    These checks are unavailable for this file. A missing answer
                    does not mean zero problems.
                  </p>
                ) : findings.length ? (
                  <ul className="space-y-2">
                    {findings.slice(0, 3).map((f) => (
                      <li key={f.id} className="rounded-xl bg-[#F5F5F7] p-3">
                        <strong>{f.ruleName}</strong>
                        <p>{f.explanation}</p>
                        {f.range && (
                          <button
                            className="mt-2 text-[#6534CC] underline"
                            onClick={() => onLocation(f.range)}
                          >
                            Show line {f.range.line}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No review findings were returned in the checks that ran.
                    Some checks may be unavailable. This does not prove
                    everything is correct or safe.
                  </p>
                )}
              </div>
            )}
            {open("Diagnostics")}
          </>
        )}
        {step === 8 && (
          <>
            <p>A friend asks: “Does CodeSentinel run my C program?”</p>
            <div className="flex flex-wrap gap-2">
              {["Yes, it runs it", "No, it reads and checks it"].map((a, i) => (
                <button
                  key={a}
                  className={button}
                  aria-pressed={answer === i}
                  onClick={() => setAnswer(i)}
                >
                  {a}
                </button>
              ))}
            </div>
            {answer !== null && (
              <p role="status" className="rounded-xl bg-[#F0EAFF] p-4">
                {answer === 1
                  ? "Exactly! It reads the code and explains supported parts. It does not run the C program."
                  : "Try again. Think of a teacher reading a recipe without cooking it."}
              </p>
            )}
            <p className="rounded-xl bg-[#F5F5F7] p-4">
              Tell your friend: “My code has pieces, names, steps and possible
              roads. The tool helps me see them and points out things to check.”
            </p>
          </>
        )}
      </section>
      <div className="flex justify-between gap-3 border-t border-[#ECEEF1] pt-4">
        <button
          className={button}
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          className={button}
          disabled={step === lessons.length - 1}
          onClick={() => setStep((s) => s + 1)}
        >
          Next idea <ArrowRight size={14} />
        </button>
      </div>
      <p className="text-xs leading-6 text-[#596171]">
        Some C features are outside this tool's coverage. “Unavailable” means no
        answer was published. The detailed views keep the real results and their
        limits.
      </p>
    </div>
  );
}
