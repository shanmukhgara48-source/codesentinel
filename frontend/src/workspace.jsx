import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  GitBranch,
  Info,
  Layers,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { ModuleStatus, Empty } from "./ui";
export function collectDiagnostics(result) {
  const items = (result.diagnostics || []).map((d, i) => ({
    ...d,
    id: `diagnostic-${i}`,
    title: d.message,
    category: "Compiler",
    code: d.code,
  }));
  for (const f of result.findings || [])
    items.push({
      ...f,
      title: f.ruleName,
      code: f.ruleId,
      category:
        {
          SECURITY: "Security",
          RESOURCE: "Resources",
          PERFORMANCE: "Performance",
          DUPLICATION: "Duplication",
        }[f.domain] || "Other",
    });
  return items;
}
function tone(severity) {
  return ["ERROR", "HIGH", "CRITICAL"].includes(severity)
    ? ["#FF4D26", "#FFF0EB", "#B13215", AlertCircle]
    : ["WARNING", "MEDIUM"].includes(severity)
      ? ["#FFCF4D", "#FFF8E4", "#725300", AlertTriangle]
      : ["#7947FF", "#F4F0FF", "#6534CC", Info];
}
function DiagnosticCard({ item, open, onToggle, onLocation, stale }) {
  const [color, background, text, Icon] = tone(item.severity);
  return (
    <article className="overflow-hidden rounded-[18px] border border-[#E6E7EB] bg-white">
      <button
        onClick={() => {
          if (!open && !stale && item.range) onLocation(item.range);
          onToggle();
        }}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-[#FAFAFC]"
      >
        <span
          style={{ backgroundColor: background, color }}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl"
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs leading-5 font-semibold">{item.title}</h3>
            <span
              style={{ backgroundColor: background, color: text }}
              className="rounded-full px-2 py-0.5 text-[9px] capitalize"
            >
              {item.severity?.toLowerCase()}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-[#686C76]">
            {item.code} · {item.category}
            {item.range && ` · Line ${item.range.line}`}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={`mt-2 shrink-0 text-[#9297A1] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-[#ECEEF1] px-4 pb-4 pt-3 text-xs leading-6 text-[#626874]">
          {item.excerpt && (
            <pre className="mb-3 overflow-auto rounded-xl bg-[#F5F5F8] px-3 py-2 font-mono text-[11px] text-[#46404F]">
              {item.excerpt}
            </pre>
          )}
          <p>{item.explanation || item.message}</p>
          {item.remediation && (
            <p className="mt-3">
              <span className="font-medium text-[#080B10]">
                Suggested action
              </span>
              <br />
              {item.remediation}
            </p>
          )}
          {item.limitations?.length > 0 && (
            <p className="mt-3 text-[10px] leading-5 text-[#686C76]">
              {item.limitations.join(" ")}
            </p>
          )}
          {item.range && (
            <button
              disabled={stale}
              onClick={() => onLocation(item.range)}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6534CC] hover:underline disabled:opacity-40"
            >
              View line {item.range.line} in source <ArrowUpRight size={12} />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
export function AnalysisOverview({ result, onLocation, onTab, stale }) {
  const items = collectDiagnostics(result),
    [open, setOpen] = useState(items[0]?.id),
    summary = result.summary,
    complete = Object.values(result.modules).filter(
      (m) => m.status === "COMPLETED",
    ).length;
  const stages = [
    ["tokens", "Tokens"],
    ["ast", "Syntax tree"],
    ["symbols", "Symbols"],
    ["tac", "Intermediate code"],
    ["cfg", "Control flow"],
    ["dataFlow", "Data flow"],
  ];
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-normal tracking-[-0.6px]">
            The bigger picture
          </h2>
          <p className="mt-1 text-[11px] text-[#686C76]">
            Results from the current analysis
          </p>
        </div>
        <span className="rounded-full border border-[#E6E7EB] px-2.5 py-1.5 text-[10px] text-[#626874]">
          {items.length} to inspect
        </span>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3">
        {[
          ["Functions", summary.functionCount, "Source definitions", Code2],
          [
            "Security findings",
            summary.securityFindings,
            "Supported rule matches",
            ShieldAlert,
          ],
          ["Tokens", summary.tokenCount, "Significant source tokens", Layers],
          [
            "Transformations",
            summary.optimizationCount,
            "Conservative TAC rewrites",
            Sparkles,
          ],
        ].map(([label, value, hint, Icon]) => (
          <div
            key={label}
            data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}
            className="rounded-[18px] bg-[#F5F5F7] p-4"
          >
            <div className="flex items-center justify-between gap-2 text-[10px] text-[#686C76]">
              <span>{label}</span>
              <Icon size={13} className="text-[#8A8E98]" />
            </div>
            <div className="mt-2 text-[30px] leading-10 tracking-[-1px] tabular-nums">
              {value ?? "—"}
            </div>
            <p className="mt-1 text-[9px] text-[#686C76]">
              {value === null ? "Stage unavailable" : hint}
            </p>
          </div>
        ))}
      </div>
      <div className="mb-5 flex items-center justify-between gap-4 rounded-[20px] bg-[#7947FF] px-5 py-4 text-white">
        <div>
          <p className="flex items-center gap-2 text-[10px] text-white/85">
            <GitBranch size={13} />
            FOLLOW THE COMPILER
          </p>
          <h3 className="mt-2 text-lg font-normal tracking-[-0.4px]">
            From source to structure.
          </h3>
          <p className="mt-1 text-[10px] leading-5 text-white/85">
            {complete} stages completed. Explore how your code takes shape.
          </p>
        </div>
        <button
          onClick={() => onTab("Compiler")}
          aria-label="Explore compiler stages"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#7947FF] transition hover:scale-105"
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold">Worth a closer look</h3>
        <button
          onClick={() => onTab("Diagnostics")}
          className="flex items-center gap-1 text-[10px] text-[#6534CC] hover:underline"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>
      <div className="space-y-2">
        {items.slice(0, 2).map((item) => (
          <DiagnosticCard
            key={item.id}
            item={item}
            open={open === item.id}
            onToggle={() => setOpen(open === item.id ? null : item.id)}
            onLocation={onLocation}
            stale={stale}
          />
        ))}
        {!items.length && (
          <div className="flex items-start gap-3 rounded-[18px] border border-[#E6E7EB] p-4">
            <Check size={18} className="text-[#7947FF]" />
            <div>
              <h3 className="text-xs font-medium">
                No findings in the assessed checks
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-[#686C76]">
                Review stage coverage below. This does not prove the program is
                safe.
              </p>
            </div>
          </div>
        )}
      </div>
      <details className="mt-5 rounded-[18px] border border-[#E6E7EB] px-4 py-3">
        <summary className="cursor-pointer text-xs font-medium">
          Analysis coverage{" "}
          <span className="ml-1 text-[10px] font-normal text-[#686C76]">
            Availability by stage
          </span>
        </summary>
        <div className="mt-3 space-y-2">
          {stages.map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between border-t border-[#ECEEF1] pt-2 text-[11px]"
            >
              <span>{label}</span>
              <ModuleStatus module={result.modules[key]} />
            </div>
          ))}
          <p className="pt-2 text-[10px] leading-5 text-[#686C76]">
            {result.modules.dataFlow?.limitations?.join(" ")}
          </p>
        </div>
      </details>
    </>
  );
}
export function DiagnosticBrowser({ result, onLocation, stale }) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [open, setOpen] = useState(null);
  const items = collectDiagnostics(result),
    filtered = items.filter(
      (d) =>
        (category === "All" || category === d.category) &&
        `${d.title} ${d.code} ${d.explanation}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <>
      <h2 className="text-[19px] tracking-[-0.6px]">A closer look</h2>
      <p className="mt-1 text-[11px] text-[#686C76]">
        Evidence, explanations, and source locations.
      </p>
      <label className="relative mt-5 block">
        <Search size={14} className="absolute top-3 left-3 text-[#8A8E98]" />
        <input
          aria-label="Search diagnostics"
          placeholder="Search diagnostics…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 w-full rounded-full border border-[#E6E7EB] bg-[#FAFAFC] pl-9 pr-4 text-xs outline-none focus:border-[#7947FF]"
        />
      </label>
      <div className="my-4 flex flex-wrap gap-2">
        {[
          "All",
          "Compiler",
          "Security",
          "Resources",
          "Performance",
          "Duplication",
        ].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`rounded-full px-3 py-1.5 text-[10px] ${category === c ? "bg-[#080B10] text-white" : "bg-[#F3F4F6] text-[#626874]"}`}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto self-center text-[10px] text-[#686C76]">
          {filtered.length} results
        </span>
      </div>
      <div className="space-y-3">
        {filtered.map((item, i) => (
          <DiagnosticCard
            key={item.id}
            item={item}
            open={open === item.id || (open === null && i === 0)}
            onToggle={() =>
              setOpen(
                open === item.id || (open === null && i === 0)
                  ? "closed"
                  : item.id,
              )
            }
            onLocation={onLocation}
            stale={stale}
          />
        ))}
        {!filtered.length && (
          <Empty
            title={
              items.length
                ? "No matching diagnostics"
                : "No diagnostics in the assessed checks"
            }
            detail={
              items.length
                ? "Try a different search or category."
                : "Check module availability and limitations before drawing conclusions."
            }
          />
        )}
      </div>
    </>
  );
}
