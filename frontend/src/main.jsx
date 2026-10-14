import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  FileCode2,
  FlaskConical,
  GitBranch,
  GripVertical,
  Layers,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import "./framework.css";
import BeginnerGuide from "./beginner";
import { ModuleStatus, Empty, button, tabKeys } from "./ui";
import {
  AnalysisOverview,
  DiagnosticBrowser,
  collectDiagnostics,
} from "./workspace";

const tabs = [
  "Start here",
  "Overview",
  "Diagnostics",
  "Compiler",
  "Control flow",
  "Optimization",
];
const CodeEditor = lazy(() => import("./editor"));
const Compiler = lazy(() => import("./compiler"));
const Cfg = lazy(() => import("./graphs").then((m) => ({ default: m.Cfg })));
const Resources = lazy(() =>
  import("./views").then((m) => ({ default: m.Resources })),
);
const Performance = lazy(() =>
  import("./views").then((m) => ({ default: m.Performance })),
);
const Duplication = lazy(() =>
  import("./views").then((m) => ({ default: m.Duplication })),
);
function download(filename, body) {
  const url = URL.createObjectURL(
    new Blob([body], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const statusLabels = {
  SUCCESS: "Analysis complete",
  SUCCESS_WITH_WARNINGS: "Completed with findings",
  SUCCESS_WITH_DIAGNOSTICS: "Completed with diagnostics",
  PARTIAL_ANALYSIS: "Partial analysis",
  PARSE_ERROR: "Syntax error",
  INTERNAL_ERROR: "Analysis failed",
};
const cExample = `#include <stdio.h>\n#include <string.h>\n\n/* A learning sample with deliberate findings. */\nint review_submission(void) {\n    int score = 2 * 8 + 1;\n    char name[16];\n    char destination[16];\n\n    scanf("%s", name);\n    strcpy(destination, name);\n\n    return score;\n}\n`;
function App() {
  const [source, setSource] = useState(cExample),
    [samples, setSamples] = useState([]),
    [sampleId, setSampleId] = useState("custom"),
    [filename, setFilename] = useState("review_submission.c");
  const [result, setResult] = useState(null),
    [analyzed, setAnalyzed] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [health, setHealth] = useState(null),
    [tab, setTab] = useState("Overview"),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(null),
    [split, setSplit] = useState(47);
  const editor = useRef(null),
    upload = useRef(null),
    sequence = useRef(0),
    controller = useRef(null),
    workspace = useRef(null),
    dialog = useRef(null),
    analysisPanel = useRef(null);
  const [additional, setAdditional] = useState(false);
  const [compilerStage, setCompilerStage] = useState("AST");
  const [guideStep, setGuideStep] = useState(0);
  const [guideAnswer, setGuideAnswer] = useState(null);
  function openGuide() {
    setTab("Start here");
    requestAnimationFrame(() => {
      analysisPanel.current?.focus({ preventScroll: true });
      analysisPanel.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }
  function navigate(section, stage = "AST") {
    setCompilerStage(stage);
    setTab(section);
    requestAnimationFrame(() => {
      if (analysisPanel.current) analysisPanel.current.scrollTop = 0;
      analysisPanel.current?.focus({ preventScroll: true });
    });
  }
  const stale =
    !!result &&
    (source !== analyzed?.source || filename !== analyzed?.filename);
  const diagnostics = result ? collectDiagnostics(result) : [];
  const canExport = !!result && !stale && !loading && !error;
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/health", { signal: abort.signal })
      .then((r) => r.json())
      .then((p) => setHealth(p.success ? p.data : false))
      .catch((e) => {
        if (e.name !== "AbortError") setHealth(false);
      });
    fetch("/api/samples", { signal: abort.signal })
      .then((r) => r.json())
      .then((p) => {
        if (!p.success) throw new Error(p.error);
        setSamples(p.data);
        // Avoid replacing edits made before the sample request returns.
        if (sequence.current === 0) {
          const hero = p.data.find((s) => s.id === "hero");
          if (hero) {
            setSource(hero.source);
            setSampleId(hero.id);
            setFilename("hero.c");
          }
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setHealth(false);
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (modal && !dialog.current.open) dialog.current.showModal();
    if (!modal && dialog.current.open) dialog.current.close();
  }, [modal]);
  function changeSource(text) {
    sequence.current++;
    controller.current?.abort();
    setLoading(false);
    setSource(text);
    setSelected(null);
    setError("");
  }
  function chooseSample(sample) {
    changeSource(sample.source);
    setSampleId(sample.id);
    setFilename(`${sample.id}.c`);
    setModal(null);
  }
  async function analyze() {
    if (!source.trim()) return;
    const snapshot = { source, filename },
      id = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    setSelected(null);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 20000);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(
          "The backend returned an unreadable response. Check it is running, then retry.",
        );
      }
      if (
        !response.ok ||
        !payload.success ||
        !payload.data?.modules ||
        !payload.data?.summary ||
        !payload.data?.sourceMetadata ||
        typeof payload.data?.analysisId !== "string"
      )
        throw new Error(
          payload.error ||
            `Analysis request failed (HTTP ${response.status}). Retry after checking the backend.`,
        );
      if (id !== sequence.current) return;
      setResult(payload.data);
      setAnalyzed(snapshot);
      setHealth(true);
      if (payload.data.status === "PARSE_ERROR") setTab("Diagnostics");
    } catch (e) {
      if ((timedOut || e.name !== "AbortError") && id === sequence.current)
        setError(
          timedOut
            ? "Analysis took longer than 20 seconds. Try a smaller program or restart the backend."
            : (e instanceof TypeError
                ? "Could not reach the Java backend. Start it and try again."
                : e.message) ||
                "Could not reach the Java backend. Start it and try again.",
        );
    } finally {
      clearTimeout(timeout);
      if (id === sequence.current) setLoading(false);
    }
  }
  function onLocation(range) {
    if (!range || stale || loading || error) return;
    setSelected({ ...range, selectionId: Date.now() });
    editor.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  function exportReport() {
    if (canExport)
      download(
        `codesentinel-${result.sourceMetadata.filename.replace(/\.c$/, "")}-${result.analysisId}.json`,
        JSON.stringify({ success: true, data: result }, null, 2),
      );
  }
  function reset() {
    changeSource("");
    setResult(null);
    setAnalyzed(null);
    setFilename("untitled.c");
    setSampleId("custom");
    setTab("Overview");
  }
  async function loadFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 65536) {
      setError("Source must be at most 64 KiB.");
      return;
    }
    const beforeRead = sequence.current;
    try {
      const text = await file.text();
      if (beforeRead !== sequence.current) return;
      changeSource(text.replaceAll("\r\n", "\n"));
      setFilename(file.name);
      setSampleId("custom");
    } catch {
      setError("Could not read this file. Try uploading it again.");
    }
  }
  function dragSplit(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = workspace.current.getBoundingClientRect();
    setSplit(
      Math.max(35, Math.min(60, ((e.clientX - rect.left) / rect.width) * 100)),
    );
  }
  useEffect(() => {
    const keydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!loading) analyze();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [source, filename, loading]);
  const status = loading
    ? "Analyzing your code"
    : error
      ? "Analysis failed · try again"
      : stale
        ? "Source changed · analyze again"
        : result
          ? statusLabels[result.status] || result.status
          : "Ready to analyze";
  return (
    <div className="motion-reduce:[&_*]:transition-none motion-reduce:[&_*]:animate-none [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[#7947FF] [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-[#7947FF] min-h-screen bg-[#F3F4F6] font-[Arial,sans-serif] text-[#080B10] antialiased [color-scheme:light]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-7 lg:px-10 lg:py-7">
        <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
          <a
            href="#analysis-panel"
            className="sr-only focus:not-sr-only focus:rounded-lg focus:bg-[#F4F0FF] focus:p-3"
          >
            Skip to analysis
          </a>
          <a
            href="/"
            aria-label="CodeSentinel home"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-[#7947FF]"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#F3F4F6]">
              <Braces size={26} strokeWidth={2.6} />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.7px]">
              Code<span className="font-normal">Sentinel</span>
              <span className="ml-1.5 text-[#7947FF]">.</span>
            </span>
          </a>
          <nav
            aria-label="Main navigation"
            className="order-3 flex w-full justify-center gap-1 rounded-full bg-[#F3F4F6] p-1 sm:order-0 sm:w-auto"
          >
            {["Workspace", "Samples", "Help"].map((name) => {
              const target = name === "Workspace" ? null : name.toLowerCase();
              return (
                <button
                  key={name}
                  onClick={() => setModal(target)}
                  aria-current={modal === target ? "page" : undefined}
                  className={`rounded-full px-5 py-2.5 text-xs font-medium transition ${modal === target ? "bg-[#080B10] text-white" : "text-[#5C616C] hover:bg-white"}`}
                >
                  {name}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-[#E5E7EB] px-3.5 py-2.5 text-[11px] text-[#5C616C] lg:inline-flex">
              <span
                className={`size-1.5 rounded-full ${health ? "bg-[#7947FF]" : "bg-[#9CA3AF]"}`}
              />
              {health === null
                ? "Connecting…"
                : health
                  ? "Local backend connected"
                  : "Backend offline"}
            </span>
            <button
              onClick={() => setModal("help")}
              aria-label="Open help"
              className="flex size-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#5C616C] hover:bg-[#EDE5FF]"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className="mt-9 flex flex-wrap items-end justify-between gap-5 lg:mt-10">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[2px] text-[#686C76]">
                <span className="size-1.5 rounded-full bg-[#7947FF]" />
                YOUR CODE, EXPLAINED
              </div>
              <h1 className="text-[32px] leading-[1.12] font-normal tracking-[-1.7px] sm:text-[43px]">
                Understand your C code<span className="text-[#7947FF]">.</span>
              </h1>
              <p className="mt-3 text-[13px] leading-6 text-[#686C76]">
                Read your code like a recipe. See its steps, choices, and things
                to check.
              </p>
              <button
                onClick={openGuide}
                className="mt-2 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-medium text-[#6534CC]"
              >
                New to coding? Start here <ArrowRight size={15} />
              </button>
            </div>
            <button
              onClick={analyze}
              disabled={loading || !source.trim()}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-[#080B10] px-6 text-sm font-medium text-white transition hover:bg-[#292532] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7947FF] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
              {loading ? "Analyzing…" : "Analyze code"}
              <span className="ml-2 hidden rounded border border-white/25 px-1.5 py-0.5 text-[10px] text-white/75 sm:inline">
                ⌘ ↵
              </span>
            </button>
          </div>
          <div className="mt-7 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-[#E5E7EB] bg-white pl-3.5 pr-3">
                <FlaskConical size={15} className="shrink-0 text-[#686C76]" />
                <select
                  aria-label="Sample program"
                  value={sampleId}
                  onChange={(e) => {
                    const s = samples.find((s) => s.id === e.target.value);
                    if (s) chooseSample(s);
                  }}
                  className="w-[135px] appearance-none bg-transparent pr-5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#7947FF]"
                >
                  <option value="custom">Custom source</option>
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.id}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-3 text-[#686C76]"
                />
              </label>
              <button onClick={() => upload.current.click()} className={button}>
                <Upload size={14} />
                Upload .c
              </button>
              <input
                ref={upload}
                type="file"
                accept=".c,.h,text/plain"
                onChange={loadFile}
                aria-label="Upload C file"
                className="hidden"
              />
              <button onClick={reset} aria-label="Reset" className={button}>
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span
                aria-live="polite"
                data-testid="analysis-status"
                className="flex items-center gap-1.5 text-[11px] text-[#686C76]"
              >
                {loading ? (
                  <LoaderCircle
                    size={13}
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <span
                    className={`size-1.5 rounded-full ${result && !stale ? "bg-[#7947FF]" : "bg-[#9CA3AF]"}`}
                  />
                )}
                {status}
              </span>
              <button
                onClick={exportReport}
                aria-label="Export JSON"
                disabled={!canExport}
                className={button}
              >
                <ArrowDownToLine size={14} />
                <span className="hidden sm:inline">Export JSON</span>
              </button>
            </div>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-3 rounded-2xl border border-[#FF4D26]/20 bg-[#FFF0EB] p-4 text-xs text-[#AD3214]"
            >
              <AlertCircle size={17} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {stale && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 rounded-2xl border border-[#FFCF4D]/50 bg-[#FFF8E4] px-4 py-3 text-xs text-[#715409]"
            >
              <AlertTriangle size={15} />
              These results belong to the previous source. Analyze again to
              update results and source links.
            </div>
          )}
          <div
            ref={workspace}
            style={{ "--editor-width": `${split}%` }}
            className="relative grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[var(--editor-width)_minmax(0,1fr)] lg:gap-5"
          >
            <section
              ref={editor}
              aria-label="Source editor"
              className="min-w-0 overflow-hidden rounded-[26px] border border-[#E2E4E9] bg-white shadow-[0_3px_15px_-10px_#11182720] lg:sticky lg:top-5"
            >
              <div className="flex min-h-[78px] items-center justify-between gap-3 border-b border-[#ECEEF1] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F0FF] text-[#7947FF]">
                    <FileCode2 size={20} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[13px] font-semibold">
                      {filename}
                    </h2>
                    <p className="mt-1 text-[10px] text-[#686C76]">
                      {sampleId === "custom"
                        ? "Single-file workspace"
                        : "Learning sample · deliberate test cases"}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-[10px] font-medium text-[#686C76]">
                  C
                </span>
              </div>
              <Suspense
                fallback={
                  <div className="h-[430px] p-5 text-xs text-[#686C76] lg:h-[635px]">
                    Opening editor…
                  </div>
                }
              >
                <CodeEditor
                  source={source}
                  onChange={changeSource}
                  selected={selected}
                />
              </Suspense>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECEEF1] px-5 py-3 text-[10px] text-[#686C76]">
                <div className="flex gap-4">
                  <span>{source ? source.split("\n").length : 0} lines</span>
                  <span>UTF-8 · Esc, then Tab to leave editor</span>
                  <span>
                    {selected
                      ? `Ln ${selected.line}, Col ${selected.column}`
                      : "Editable source"}
                  </span>
                </div>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} />
                  Analyzed, never executed
                </span>
              </div>
            </section>
            <div
              role="separator"
              aria-label="Resize editor"
              aria-orientation="vertical"
              aria-valuemin={35}
              aria-valuemax={60}
              aria-valuenow={Math.round(split)}
              tabIndex={0}
              onPointerDown={dragSplit}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  dragSplit(e);
              }}
              onPointerUp={(e) =>
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                  e.preventDefault();
                  setSplit((s) =>
                    Math.max(
                      35,
                      Math.min(60, s + (e.key === "ArrowRight" ? 2 : -2)),
                    ),
                  );
                }
              }}
              style={{ left: `calc(${split}% + 2px)` }}
              className="absolute top-7 z-10 hidden h-[660px] w-4 cursor-col-resize touch-none items-center justify-center rounded-full text-[#B2B6C0] hover:bg-[#EDE5FF] hover:text-[#7947FF] focus-visible:outline-2 focus-visible:outline-[#7947FF] lg:flex"
            >
              <GripVertical size={13} />
            </div>
            <section
              aria-label="Analysis results"
              className="min-w-0 overflow-hidden rounded-[26px] border border-[#E2E4E9] bg-white shadow-[0_3px_15px_-10px_#11182720]"
            >
              <div className="flex min-h-[78px] flex-wrap items-center justify-between gap-3 border-b border-[#ECEEF1] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#F3F4F6]">
                    <Layers size={19} />
                  </span>
                  <div>
                    <h2 className="text-[13px] font-semibold">
                      Analysis workspace
                    </h2>
                    <p className="mt-1 text-[10px] text-[#686C76]">
                      A closer look at your code
                    </p>
                  </div>
                </div>
                {result && !loading && (
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-medium ${result.status === "PARSE_ERROR" ? "bg-[#FFF0EB] text-[#AD3214]" : "bg-[#F4F0FF] text-[#6534CC]"}`}
                  >
                    {result.status === "PARSE_ERROR" ? (
                      <AlertCircle size={11} />
                    ) : (
                      <Check size={11} />
                    )}
                    {stale || error ? "Previous result" : "Result ready"}
                  </span>
                )}
              </div>
              <div
                role="tablist"
                aria-label="Analysis sections"
                onKeyDown={tabKeys}
                className="flex gap-1 overflow-x-auto border-b border-[#ECEEF1] px-4 py-3"
              >
                {tabs.map((t) => (
                  <button
                    key={t}
                    id={`tab-${t.replaceAll(" ", "-")}`}
                    role="tab"
                    aria-controls="analysis-panel"
                    aria-selected={tab === t}
                    tabIndex={tab === t ? 0 : -1}
                    onClick={() => setTab(t)}
                    className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-medium transition ${tab === t ? "bg-[#F0EAFF] text-[#6131CA]" : "text-[#686C76] hover:bg-[#F3F4F6]"}`}
                  >
                    {t}
                    {t === "Diagnostics" && result && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${tab === t ? "bg-[#7947FF] text-white" : "bg-[#F3F4F6] text-[#5C616C]"}`}
                      >
                        {diagnostics.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div
                ref={analysisPanel}
                id="analysis-panel"
                role="tabpanel"
                tabIndex={0}
                aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`}
                aria-busy={loading}
                className="min-h-[550px] p-4 sm:p-5 lg:h-[616px] lg:min-h-0 lg:overflow-y-auto"
              >
                {tab === "Start here" ? (
                  <BeginnerGuide
                    step={guideStep}
                    setStep={setGuideStep}
                    answer={guideAnswer}
                    setAnswer={setGuideAnswer}
                    result={result}
                    stale={stale}
                    loading={loading}
                    error={error}
                    onLoadExample={() => {
                      const sample = samples.find((s) => s.id === "arithmetic");
                      if (sample) chooseSample(sample);
                    }}
                    canLoadExample={samples.some((s) => s.id === "arithmetic")}
                    onAnalyze={analyze}
                    canAnalyze={!!source.trim()}
                    onNavigate={navigate}
                    onLocation={onLocation}
                  />
                ) : loading ? (
                  <div
                    role="status"
                    className="flex min-h-[530px] flex-col items-center justify-center text-center"
                  >
                    <div className="mb-6 flex size-16 items-center justify-center rounded-[22px] bg-[#F4F0FF] text-[#7947FF]">
                      <LoaderCircle
                        size={28}
                        className="animate-spin motion-reduce:animate-none"
                      />
                    </div>
                    <h3 className="text-lg tracking-tight">
                      Making sense of your code
                    </h3>
                    <p className="mt-3 max-w-[260px] text-xs leading-6 text-[#686C76]">
                      Parsing source, building compiler stages, and checking
                      supported rules.
                    </p>
                  </div>
                ) : !result ? (
                  <div className="flex min-h-[530px] flex-col items-center justify-center px-2 text-center">
                    <div className="relative mb-7 flex size-24 items-center justify-center rounded-[30px] border border-[#E6DBFF] bg-[#F8F5FF]">
                      <Braces
                        size={42}
                        strokeWidth={1.3}
                        className="text-[#7947FF]"
                      />
                      <span className="absolute -right-2 -bottom-2 flex size-8 items-center justify-center rounded-full border-4 border-white bg-[#080B10] text-white">
                        <Sparkles size={13} />
                      </span>
                    </div>
                    <p className="mb-2 text-[10px] font-semibold tracking-[1.6px] text-[#8A7AAB]">
                      LET’S LOOK UNDER THE HOOD
                    </p>
                    <h3 className="text-[24px] tracking-[-0.8px]">
                      Your code has a story.
                    </h3>
                    <p className="mt-3 max-w-[280px] text-xs leading-6 text-[#686C76]">
                      Run an analysis to explore how your program is structured
                      and what deserves a closer look.
                    </p>
                    <button
                      onClick={analyze}
                      disabled={!source.trim()}
                      className="mt-6 flex items-center gap-2 text-xs font-medium text-[#6534CC] hover:underline disabled:opacity-40"
                    >
                      Analyze your first file <ArrowRight size={14} />
                    </button>
                    <div className="mt-12 flex flex-wrap justify-center gap-4 text-[10px] text-[#686C76]">
                      <span className="flex items-center gap-1.5">
                        <Code2 size={13} />
                        Source diagnostics
                      </span>
                      <span className="flex items-center gap-1.5">
                        <GitBranch size={13} />
                        Compiler insights
                      </span>
                    </div>
                  </div>
                ) : (
                  <Suspense
                    fallback={
                      <Empty
                        title="Opening this stage…"
                        detail="Loading the analysis view."
                        compact
                      />
                    }
                  >
                    <div className={stale ? "opacity-65" : ""}>
                      {tab === "Overview" && (
                        <AnalysisOverview
                          key={result.analysisId}
                          result={result}
                          onLocation={onLocation}
                          onTab={setTab}
                          stale={stale}
                        />
                      )}
                      {tab === "Diagnostics" && (
                        <DiagnosticBrowser
                          key={result.analysisId}
                          result={result}
                          onLocation={onLocation}
                          stale={stale}
                        />
                      )}
                      {tab === "Compiler" && (
                        <Compiler
                          key={`compiler-${result.analysisId}-${compilerStage}`}
                          result={result}
                          onLocation={onLocation}
                          initialTab={compilerStage}
                          stages={[
                            "AST",
                            "Symbols",
                            "Tokens",
                            "Semantics",
                            "Data flow",
                          ]}
                        />
                      )}
                      {tab === "Control flow" && (
                        <Cfg
                          key={result.analysisId}
                          module={result.modules.cfg}
                          onLocation={onLocation}
                        />
                      )}
                      {tab === "Optimization" && (
                        <Compiler
                          key={`opt-${result.analysisId}`}
                          result={result}
                          onLocation={onLocation}
                          initialTab="TAC & optimization"
                          stages={["TAC & optimization"]}
                        />
                      )}
                    </div>
                  </Suspense>
                )}
              </div>
            </section>
          </div>
          {result && !loading && (
            <details
              onToggle={(e) => setAdditional(e.currentTarget.open)}
              className="mt-5 rounded-[24px] border border-[#E2E4E9] bg-white px-5 py-4"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-xs font-medium">
                Additional analysis{" "}
                <span className="text-[11px] font-normal text-[#686C76]">
                  Resources, complexity & duplication{" "}
                  <ChevronDown size={13} className="ml-1 inline" />
                </span>
              </summary>
              {additional && (
                <Suspense
                  fallback={
                    <Empty title="Opening additional analysis…" compact />
                  }
                >
                  <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
                    <div>
                      <Resources result={result} onLocation={onLocation} />
                    </div>
                    <div>
                      <Performance result={result} onLocation={onLocation} />
                      <div className="mt-5">
                        <Duplication result={result} onLocation={onLocation} />
                      </div>
                    </div>
                  </div>
                </Suspense>
              )}
            </details>
          )}
          <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1 pb-2 text-[10px] text-[#686C76]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} />
              Local-first · single-file C analysis
            </span>
            <span>
              Limited library catalog. Findings are heuristics, not guarantees.
              <button
                onClick={() => setModal("help")}
                className="ml-2 text-[#6534CC] hover:underline"
              >
                Learn more <ArrowUpRight size={10} className="inline" />
              </button>
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClose={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
        aria-labelledby="dialog-title"
        className="fixed inset-0 m-auto max-h-[85vh] w-[min(620px,calc(100%-32px))] overflow-auto rounded-[28px] border border-[#E5E7EB] bg-white p-6 text-[#080B10] shadow-xl backdrop:bg-[#080B10]/30"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="dialog-title" className="text-xl tracking-tight">
            {modal === "samples"
              ? "A little code. A lot to explore."
              : "Get to know your workbench."}
          </h2>
          <button
            aria-label="Close dialog"
            onClick={() => setModal(null)}
            className="ml-4 rounded-full bg-[#F3F4F6] p-2"
          >
            <X size={16} />
          </button>
        </div>
        {modal === "samples" ? (
          <>
            <p className="mb-5 text-xs leading-6 text-[#686C76]">
              Learning samples include intentional risks and unsupported cases.
              Selecting a sample replaces the editor contents.
            </p>
            <div className="space-y-2">
              {samples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => chooseSample(s)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#E5E7EB] p-4 text-left hover:border-[#7947FF] hover:bg-[#F8F5FF]"
                >
                  <FileCode2 size={18} className="shrink-0 text-[#7947FF]" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {s.name || s.id}
                    </span>
                    <p className="mt-1 text-xs leading-5 text-[#686C76]">
                      {s.purpose}
                    </p>
                  </div>
                  <ArrowRight size={15} />
                </button>
              ))}
              {!samples.length && (
                <Empty
                  title="Backend samples unavailable"
                  detail="You can still edit or upload C code. Start the backend to load the sample library."
                  compact
                />
              )}
            </div>
          </>
        ) : (
          <div className="space-y-5 text-xs leading-6 text-[#686C76]">
            <div className="rounded-2xl bg-[#F4F0FF] p-4 text-[#6534CC]">
              1. Load a sample or upload a C file.
              <br />
              2. Select Analyze code, or press Ctrl/⌘ + Enter.
              <br />
              3. Explore a result and select a source location.
            </div>
            <p>
              CodeSentinel analyzes source without executing it. Compiler views
              expose AST nodes, symbols, tokens, intermediate code, and control
              flow. Optimization shows actual conservative TAC rewrites.
            </p>
            <p>
              Only single-file laboratory C and a limited stdio.h, stdlib.h,
              string.h, and stddef.h catalog are modeled. Macros and unsupported
              constructs can withhold results. Live variables and reaching
              definitions explain scalar data flow with fixed-point traces.
              Memory contents and full C types remain outside the model.
            </p>
            <p>
              Editing the source makes existing results stale. Analyze again to
              enable source links and export. JSON reports omit the source and
              redact recognized credential values.
            </p>
            <div className="rounded-2xl border border-[#E5E7EB] p-4">
              <span className="font-semibold text-[#080B10]">
                Start locally
              </span>
              <pre className="mt-2 overflow-auto font-mono text-[11px]">
                ./scripts/setup.sh{"\n"}./scripts/start.sh
              </pre>
              <p className="mt-2">
                Requires Java 21 and Node.js. The backend runs on port 8080.
              </p>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
