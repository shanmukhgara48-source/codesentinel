import React, { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileSearch,
  Search,
} from "lucide-react";
export const panel =
  "min-w-0 overflow-hidden rounded-[18px] border border-[#E5E7EB] bg-white";
export const muted = "text-[#686C76]";
export const button =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#E2E4E9] bg-white px-3.5 text-xs font-medium text-[#30343E] transition-colors hover:border-[#CBCED6] hover:bg-[#F8F5FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7947FF] disabled:opacity-35 disabled:cursor-not-allowed";
export const metricStrip =
  "mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#E5E7EB] bg-[#E5E7EB] xl:grid-cols-4";
const sentenceCase = (value) => value.charAt(0) + value.slice(1).toLowerCase();
export function Badge({ children, tone = "neutral" }) {
  const colors = {
    neutral: "border-[#E5E7EB] bg-[#F3F4F6] text-[#434955]",
    green: "border-[#7947FF]/20 bg-[#7947FF]/8 text-[#6534CC]",
    amber: "border-[#A67400]/20 bg-[#A67400]/8 text-[#A67400]",
    red: "border-[#FF4D26]/20 bg-[#FF4D26]/8 text-[#B13215]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium leading-5 ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
export function ModuleStatus({ module }) {
  const states = {
    COMPLETED: ["Completed", "text-[#6534CC]"],
    PARTIAL: ["Partial", "text-[#A67400]"],
    SKIPPED: ["Skipped", "text-[#686C76]"],
    FAILED: ["Failed", "text-[#B13215]"],
    NOT_IMPLEMENTED: ["Not implemented", "text-[#686C76]"],
  };
  const [label, color] = states[module?.status] || ["Not analyzed", muted];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] ${color}`}
    >
      {module?.status === "COMPLETED" ? (
        <Check size={12} />
      ) : (
        <span className="size-1 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}
export function Severity({ value }) {
  return (
    <Badge
      tone={
        ["HIGH", "CRITICAL"].includes(value)
          ? "red"
          : value === "MEDIUM"
            ? "amber"
            : value === "LOW"
              ? "green"
              : "neutral"
      }
    >
      {sentenceCase(value || "Unknown")}
    </Badge>
  );
}
export function Panel({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`${panel} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEEF1] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#080B10]">{title}</h2>
          {subtitle && (
            <p className={`mt-1 text-xs leading-relaxed ${muted}`}>
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title = "No analysis yet",
  detail = "Load a sample or enter C source, then select Analyze.",
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? "p-8" : "min-h-56 p-10"}`}
    >
      <FileSearch size={25} strokeWidth={1.3} className="mb-4 text-[#8B8F99]" />
      <h3 className="text-sm font-medium text-[#080B10]">{title}</h3>
      <p className={`mt-2 max-w-sm text-xs leading-6 ${muted}`}>{detail}</p>
    </div>
  );
}
export function Unavailable({ module, label }) {
  return (
    <Panel
      title={label || "Analysis unavailable"}
      actions={<ModuleStatus module={module} />}
    >
      <Empty
        title="This stage has no published result"
        detail={
          module?.limitations?.join(" ") ||
          "Analyze a supported C program to begin."
        }
      />
      {module?.diagnostics?.length > 0 && (
        <Diagnostics items={module.diagnostics} />
      )}
    </Panel>
  );
}
export function Coverage({ module }) {
  if (!module?.limitations?.length) return null;
  return (
    <div className="flex items-start gap-2 border-t border-[#ECEEF1] px-5 py-3 text-[11px] leading-5 text-[#686C76]">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <p>{module.limitations?.join(" ")}</p>
    </div>
  );
}
export function Stat({ label, value, hint }) {
  return (
    <div
      className="min-w-0 bg-white px-5 py-4"
      data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div
        className={`flex items-center justify-between gap-2 text-xs ${muted}`}
      >
        <span>{label}</span>
      </div>
      <div className="mt-2 text-[26px] font-medium leading-9 tabular-nums tracking-tight text-[#080B10]">
        {value ?? "—"}
      </div>
      <p className={`mt-1 text-[11px] leading-5 ${muted}`}>{hint}</p>
    </div>
  );
}
export function Table({ columns, rows, empty = "No rows in this result." }) {
  return (
    <div className="max-w-full overflow-auto">
      <table className="w-full border-collapse text-left text-[13px] leading-5">
        <thead className="bg-[#F9F9FB] text-xs text-[#686C76]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-5 py-2.5 font-medium"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id || i}
              className="border-t border-[#ECEEF1] hover:bg-[#F9F9FB]"
            >
              {columns.map((c) => (
                <td key={c.key} className="px-5 py-3 align-top">
                  {c.render ? c.render(r) : (r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className={`p-6 text-xs ${muted}`}>{empty}</p>}
    </div>
  );
}
export function Diagnostics({ items = [], onLocation }) {
  return (
    <div className="space-y-2 p-5">
      {items.length ? (
        items.map((d, i) => (
          <div
            key={`${d.code}-${i}`}
            className="rounded-md border border-amber-400/15 bg-amber-400/5 p-3 text-xs"
            role={d.severity === "ERROR" ? "alert" : undefined}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-[#725300]">
                {d.code} · {d.message}
              </span>
              {d.range && (
                <button
                  className="text-[#6534CC] hover:underline"
                  onClick={() => onLocation?.(d.range)}
                >
                  Line {d.range.line}, column {d.range.column}
                </button>
              )}
            </div>
            <p className={`mt-2 leading-5 ${muted}`}>{d.explanation}</p>
          </div>
        ))
      ) : (
        <p className={`text-xs ${muted}`}>
          No diagnostics from the assessed checks.
        </p>
      )}
    </div>
  );
}
export function FindingList({
  findings = [],
  onLocation,
  compact = false,
  empty = "No findings in the assessed scope.",
}) {
  const [severity, setSeverity] = useState("ALL"),
    [query, setQuery] = useState("");
  const filtered = findings.filter(
    (f) =>
      (severity === "ALL" || f.severity === severity) &&
      `${f.ruleId} ${f.ruleName} ${f.functionName} ${f.explanation}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      {!compact && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[#ECEEF1] px-5 py-4">
          <label className="relative min-w-[140px] flex-1">
            <Search
              size={14}
              className="absolute top-3 left-3 text-[#686C76]"
            />
            <input
              aria-label="Search findings"
              placeholder="Search findings…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-[#E2E4E9] bg-[#F7F7FA] py-2.5 pr-3 pl-9 text-xs outline-none focus:border-[#7947FF]"
            />
          </label>
          <select
            aria-label="Severity filter"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded border border-[#E2E4E9] bg-[#F7F7FA] px-3 py-2.5 text-xs"
          >
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"].map(
              (s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All severities" : sentenceCase(s)}
                </option>
              ),
            )}
          </select>
          <span className="text-xs tabular-nums text-[#686C76]">
            {filtered.length} of {findings.length}
          </span>
        </div>
      )}
      <div className="divide-y divide-[#ECEEF1]">
        {filtered.map((f) => (
          <details key={f.id} className="group px-5 py-5 open:bg-[#FAFAFC]">
            <summary className="flex cursor-pointer list-none items-start gap-3">
              <ChevronRight
                size={14}
                className="mt-1 shrink-0 text-[#686C76] group-open:rotate-90"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium leading-5 text-[#080B10]">
                    {f.ruleName}
                  </span>
                  <Severity value={f.severity} />
                </div>
                <p className={`mt-2 text-[11px] leading-5 ${muted}`}>
                  {f.ruleId} · {f.functionName} · {f.confidence.toLowerCase()}{" "}
                  confidence
                </p>
                {compact && (
                  <p className="mt-2 text-xs leading-6 text-[#686C76]">
                    {f.explanation}
                  </p>
                )}
              </div>
              <button
                className="flex shrink-0 items-center gap-1 text-xs text-[#6534CC] hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  onLocation?.(f.range);
                }}
              >
                Line {f.range.line}
                <ArrowUpRight size={12} />
              </button>
            </summary>
            <div className="mt-4 space-y-3 text-[13px] leading-6 sm:pl-6">
              <pre className="overflow-auto rounded-md border border-[#E5E7EB] bg-[#F7F7FA] p-3 font-mono text-[#434955]">
                {f.excerpt}
              </pre>
              <p>{f.explanation}</p>
              <p className={muted}>
                <span className="text-[#6534CC]">Suggested action · </span>
                {f.remediation}
              </p>
              <p className="text-[11px] text-[#686C76]">
                {f.limitations.join(" ")}
              </p>
            </div>
          </details>
        ))}
        {!filtered.length && (
          <Empty
            title={empty}
            detail="This reflects only the implemented checks and their supported coverage."
            compact
          />
        )}
      </div>
    </>
  );
}
export function SectionHeading({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-semibold leading-8 tracking-tight text-[#080B10]">
          {title}
        </h1>
        <p className={`mt-1.5 text-[13px] leading-6 ${muted}`}>{description}</p>
      </div>
      {children}
    </div>
  );
}
