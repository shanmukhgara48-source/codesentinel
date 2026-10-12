import React, { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { ArrowUpRight, Download } from "lucide-react";
import {
  Panel,
  Stat,
  Table,
  FindingList,
  Coverage,
  ModuleStatus,
  Unavailable,
  Empty,
  muted,
  button,
  metricStrip,
} from "./ui";
export function download(filename, body, type = "application/json") {
  const url = URL.createObjectURL(new Blob([body], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const severityColors = {
  CRITICAL: "#d77382",
  HIGH: "#FF4D26",
  MEDIUM: "#A67400",
  LOW: "#7947FF",
  INFORMATIONAL: "#8296ad",
};
export function SeverityChart({ risk }) {
  const values = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"].map(
    (name) => ({
      name:
        name === "INFORMATIONAL"
          ? "Info"
          : name.charAt(0) + name.slice(1).toLowerCase(),
      value: risk.severityDistribution[name] || 0,
      color: severityColors[name],
    }),
  );
  if (!values.some((v) => v.value))
    return (
      <Empty
        compact
        title="No scored findings"
        detail="The implemented rules found no scored warning in the assessed scope."
      />
    );
  return (
    <div className="h-[156px] px-4 pt-2 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={values}
          layout="vertical"
          margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
        >
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            width={65}
            tick={{ fill: "#686C76", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#ffffff05" }}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #3a3d46",
              borderRadius: 4,
              color: "#e2e8f0",
              fontSize: 12,
            }}
          />
          <Bar
            isAnimationActive={false}
            dataKey="value"
            name="Findings"
            radius={[0, 2, 2, 0]}
            maxBarSize={10}
          >
            {values.map((v) => (
              <Cell key={v.name} fill={v.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              fill="#434955"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Summary({ result }) {
  const s = result.summary;
  return (
    <div className={metricStrip}>
      <Stat
        label="Functions"
        value={s.functionCount}
        hint={`${s.assessedFunctions ?? "—"} with generated CFG`}
      />
      <Stat
        label="Security findings"
        value={s.securityFindings}
        hint="Source-derived rule matches"
      />
      <Stat
        label="Resource warnings"
        value={s.resourceWarnings}
        hint="Local source heuristics"
      />
      <Stat
        label="Transformations"
        value={s.optimizationCount}
        hint="Actual TAC rewrites"
      />
    </div>
  );
}
export function Overview({ result, onLocation, onNavigate }) {
  const risk = result.modules.risk?.data,
    performance = result.modules.performance?.data;
  if (!risk)
    return <Unavailable module={result.modules.risk} label="Overview" />;
  return (
    <>
      <Summary result={result} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <Panel
          title="Findings to inspect"
          subtitle={`${result.findings.length} findings across the assessed source`}
          actions={
            <button
              className="flex items-center gap-1 text-xs text-[#6534CC] hover:underline"
              onClick={() => onNavigate("Security")}
            >
              Security view <ArrowUpRight size={12} />
            </button>
          }
        >
          <FindingList
            compact
            findings={(result.findings || []).slice(0, 5)}
            onLocation={onLocation}
          />
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#ECEEF1] px-5 py-3 text-[11px] text-[#686C76]">
            <span>{result.summary.totalLines ?? "—"} source lines</span>
            <span>{result.summary.tokenCount} significant tokens</span>
            <span>{performance?.maxNesting ?? "—"} max control nesting</span>
          </div>
        </Panel>
        <Panel
          title="Review priority"
          subtitle="Heuristic score · assessed findings only"
        >
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[34px] font-medium leading-10 tracking-tight tabular-nums text-[#080B10]">
                {risk.score}
              </span>
              <span className="text-xs text-[#686C76]">/ 100</span>
              <span className="ml-auto text-xs text-[#686C76]">
                {result.findings.length} findings
              </span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-sm bg-[#E5E7EB]">
              <div
                className="h-full bg-[#7947FF]"
                style={{ width: `${risk.score}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#686C76]">
              Severity × confidence. A review aid, not a probability of
              exploitation.
            </p>
          </div>
          <div className="border-t border-[#ECEEF1] px-5 pt-3 text-xs font-medium text-[#434955]">
            Finding severity
          </div>
          <SeverityChart risk={risk} />
          <Coverage module={result.modules.risk} />
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <Panel
          title="Score contributions"
          subtitle="The weight and confidence behind each scored finding."
        >
          <Table
            columns={[
              {
                key: "ruleId",
                label: "Rule",
                render: (r) => (
                  <button
                    className="whitespace-nowrap font-mono text-xs text-[#6534CC] hover:underline"
                    onClick={() => {
                      const f = result.findings.find(
                        (f) => f.id === r.findingId,
                      );
                      if (f) onLocation(f.range);
                    }}
                  >
                    {r.ruleId}
                  </button>
                ),
              },
              {
                key: "severity",
                label: "Severity",
                render: (r) =>
                  r.severity.charAt(0) + r.severity.slice(1).toLowerCase(),
              },
              {
                key: "confidence",
                label: "Confidence",
                render: (r) =>
                  r.confidence.charAt(0) + r.confidence.slice(1).toLowerCase(),
              },
              {
                key: "points",
                label: "Points",
                render: (r) => (
                  <span className="font-medium tabular-nums">{r.points}</span>
                ),
              },
            ]}
            rows={risk.contributions}
          />
          <div className="space-y-2 border-t border-[#ECEEF1] px-5 py-3 text-xs text-[#686C76]">
            {Object.entries(risk.functionScores).map(([name, score]) => (
              <div key={name} className="flex flex-wrap justify-between gap-2">
                <code className="text-[#434955]">{name}</code>
                <span>{score} points</span>
              </div>
            ))}
            {!risk.contributions.length && (
              <span>No scored findings in the assessed scope.</span>
            )}
          </div>
          <details className="border-t border-[#ECEEF1] px-5 py-3 text-[11px] text-[#686C76]">
            <summary className="cursor-pointer">Scoring formula</summary>
            <p className="mt-2 leading-5">{risk.formula}</p>
          </details>
        </Panel>
        <Panel
          title="Pipeline coverage"
          subtitle="Availability and limitations for each analysis stage."
        >
          <div className="grid grid-cols-1 gap-x-6 px-5 py-2 min-[420px]:grid-cols-2">
            {Object.entries(result.modules)
              .filter(([key]) => !["preprocessing", "risk"].includes(key))
              .map(([key, module]) => (
                <div
                  key={key}
                  className="flex min-w-0 items-center justify-between gap-2 border-b border-[#ECEEF1] py-2.5 text-xs"
                >
                  <span className="text-[#434955]">
                    {{
                      ast: "AST",
                      tac: "TAC",
                      cfg: "CFG",
                      dataFlow: "Data flow",
                    }[key] || key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                  <ModuleStatus module={module} />
                </div>
              ))}
          </div>
          <div className="border-t border-[#ECEEF1] px-5 py-3 text-[11px] text-[#686C76]">
            Open a stage to review its supported scope.
          </div>
        </Panel>
      </div>
    </>
  );
}
export function Security({ result, onLocation }) {
  const m = result.modules.security;
  if (!m?.data) return <Unavailable module={m} label="Security analysis" />;
  return (
    <Panel
      title="Security findings"
      subtitle={`${m.data.length} rule matches · each finding includes its evidence boundary`}
      actions={<ModuleStatus module={m} />}
    >
      <FindingList findings={m.data} onLocation={onLocation} />
      <Coverage module={m} />
    </Panel>
  );
}
export function Resources({ result, onLocation }) {
  const m = result.modules.resources;
  if (!m?.data) return <Unavailable module={m} label="Resource analytics" />;
  const d = m.data;
  return (
    <>
      <div className={metricStrip}>
        <Stat
          label="Allocation calls"
          value={d.allocationCalls}
          hint="Includes realloc sites"
        />
        <Stat
          label="Free calls"
          value={d.deallocationCalls}
          hint="Source sites, not runtime events"
        />
        <Stat
          label="Inside loops"
          value={d.allocationsInsideLoops}
          hint="Allocation sites in loop bodies"
        />
        <Stat
          label="Realloc calls"
          value={d.reallocationCalls}
          hint="Ownership remains unknown"
        />
      </div>
      <Panel
        title="Allocation sites"
        subtitle="A visible release or check does not prove correctness on every path."
        actions={<ModuleStatus module={m} />}
      >
        <Table
          columns={[
            {
              key: "api",
              label: "API",
              render: (r) => <code className="text-[#6534CC]">{r.api}</code>,
            },
            { key: "functionName", label: "Function" },
            {
              key: "variable",
              label: "Assigned variable",
              render: (r) => r.variable || "unassigned",
            },
            {
              key: "ownership",
              label: "Ownership hint",
              render: (r) => r.ownership.replaceAll("_", " ").toLowerCase(),
            },
            {
              key: "nullCheckRecognized",
              label: "Null guard",
              render: (r) =>
                r.nullCheckRecognized ? "recognized" : "not recognized",
            },
            {
              key: "localFreeVisible",
              label: "Later free",
              render: (r) => (r.localFreeVisible ? "visible" : "not visible"),
            },
            {
              key: "range",
              label: "Source",
              render: (r) => (
                <button
                  onClick={() => onLocation(r.range)}
                  className="text-[#6534CC] hover:underline"
                >
                  Line {r.range.line}
                </button>
              ),
            },
          ]}
          rows={d.allocations}
        />
        <Coverage module={m} />
      </Panel>
      <Panel title="Resource warnings" className="mt-4">
        <FindingList findings={d.findings} onLocation={onLocation} />
      </Panel>
    </>
  );
}
export function Performance({ result, onLocation }) {
  const m = result.modules.performance;
  if (!m?.data) return <Unavailable module={m} label="Performance metrics" />;
  const d = m.data,
    functions = [...d.functions].sort(
      (a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity,
    );
  return (
    <>
      <div className={metricStrip}>
        <Stat
          label="Physical lines"
          value={d.totalLines}
          hint={`${d.nonEmptyLines} non-empty · ${d.commentLines} with comments`}
        />
        <Stat
          label="Decision branches"
          value={d.branchCount}
          hint="if statements in assessed syntax"
        />
        <Stat label="Loops" value={d.loopCount} hint="for, while, do-while" />
        <Stat
          label="Maximum nesting"
          value={d.maxNesting}
          hint="Control nesting, not block depth"
        />
      </div>
      <Panel
        title="Complexity by function"
        subtitle="M = 1 + if + loops + && + ||. This is a source metric."
        actions={<ModuleStatus module={m} />}
      >
        <div className="h-56 p-5">
          {functions.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={functions}
                margin={{ left: -20, right: 10, bottom: 10 }}
              >
                <CartesianGrid stroke="#ffffff0a" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#686C76", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#686C76", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #3a3d46",
                    color: "#434955",
                    fontSize: 12,
                  }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="cyclomaticComplexity"
                  name="Cyclomatic complexity"
                  fill="#7947FF"
                  maxBarSize={40}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty compact title="No functions to chart" />
          )}
        </div>
        <Table
          columns={[
            {
              key: "name",
              label: "Function",
              render: (r) => (
                <button
                  onClick={() => onLocation(r.range)}
                  className="font-mono text-[#6534CC] hover:underline"
                >
                  {r.name}
                </button>
              ),
            },
            { key: "cyclomaticComplexity", label: "Complexity" },
            { key: "declarations", label: "Declarations" },
            { key: "branches", label: "Branches" },
            { key: "loops", label: "Loops" },
            { key: "maxNesting", label: "Nesting" },
            { key: "status", label: "Coverage" },
          ]}
          rows={functions}
        />
        <Coverage module={m} />
      </Panel>
      <Panel title="Structure warnings" className="mt-4">
        <FindingList findings={d.findings} onLocation={onLocation} />
      </Panel>
    </>
  );
}
export function Duplication({ result, onLocation }) {
  const m = result.modules.duplication;
  if (!m?.data) return <Unavailable module={m} label="Code duplication" />;
  return (
    <Panel
      title="Repeated function bodies"
      subtitle="At least 30 significant tokens; whitespace/comments are ignored."
      actions={<ModuleStatus module={m} />}
    >
      <Table
        columns={[
          {
            key: "matchType",
            label: "Match type",
            render: (r) => r.matchType.replaceAll("_", " ").toLowerCase(),
          },
          {
            key: "firstFunction",
            label: "First occurrence",
            render: (r) => (
              <button
                className="text-[#6534CC] hover:underline"
                onClick={() => onLocation(r.firstRange)}
              >
                {r.firstFunction} · line {r.firstRange.line}
              </button>
            ),
          },
          {
            key: "secondFunction",
            label: "Second occurrence",
            render: (r) => (
              <button
                className="text-[#6534CC] hover:underline"
                onClick={() => onLocation(r.secondRange)}
              >
                {r.secondFunction} · line {r.secondRange.line}
              </button>
            ),
          },
          { key: "tokenCount", label: "Tokens" },
        ]}
        rows={m.data.matches}
        empty="No whole-function fingerprint matches in this source."
      />
      <Coverage module={m} />
    </Panel>
  );
}
const docs = import.meta.glob("../../docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const documentTitles = {
  ARCHITECTURE: "Architecture",
  COMPILER_CONCEPTS: "Compiler concepts",
  PARSER_WALKTHROUGH: "Parser walkthrough",
  SECURITY_RULES: "Security rules",
  ANALYSIS_LIMITATIONS: "Analysis limitations",
  VIVA_GUIDE: "Viva guide",
  THIRD_PARTY: "Grammar & attribution",
};
const documentLabel = (key) =>
  documentTitles[key.split("/").pop().replace(".md", "")] ||
  key.split("/").pop().replace(".md", "").replaceAll("_", " ");
export function Reports({ result, onExport, stale }) {
  const [selected, setSelected] = useState("");
  const entries = Object.entries(docs)
    .filter(([key]) => !key.includes("VERIFICATION"))
    .sort(
      ([a], [b]) =>
        Object.keys(documentTitles).indexOf(
          a.split("/").pop().replace(".md", ""),
        ) -
        Object.keys(documentTitles).indexOf(
          b.split("/").pop().replace(".md", ""),
        ),
    );
  const document = entries.find(([key]) => key === selected) || entries[0];
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Analysis report"
          subtitle="Export the current response, with source metadata and limitations."
        >
          <div className="p-5">
            <p className={`text-xs leading-6 ${muted}`}>
              JSON contains actual compiler outputs, metrics, findings,
              transformation explanations, and per-module coverage. Raw source
              is excluded and suspected credential values are redacted.
            </p>
            <button
              className={`${button} mt-4`}
              disabled={!result || stale}
              onClick={onExport}
            >
              <Download size={14} />
              Export JSON
            </button>
            {result && (
              <p className="mt-3 break-all font-mono text-[10px] text-[#686C76]">
                {result.analysisId} · schema {result.schemaVersion}
              </p>
            )}
          </div>
        </Panel>
        <Panel
          title="How to demonstrate it"
          subtitle="One source program connects every implemented stage."
        >
          <ol className="space-y-2 p-5 text-xs leading-5 text-[#434955]">
            {[
              "Load Full pipeline and analyze.",
              "Inspect tokens, AST, symbols, and a source-linked finding.",
              "Compare TAC and explain both transformation passes.",
              "Inspect a CFG block, resource sites, and score contributions.",
              "Export JSON; then show syntax-error recovery.",
            ].map((s, i) => (
              <li key={s}>
                <span className="mr-2 font-mono text-[#7947FF]">0{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <Panel
        title="Documentation & viva notes"
        subtitle="These documents describe the implementation in this project."
        className="mt-4"
        actions={
          document && (
            <button
              className={button}
              onClick={() =>
                download(
                  document[0].split("/").pop(),
                  document[1],
                  "text/markdown",
                )
              }
            >
              <Download size={12} />
              Download notes
            </button>
          )
        }
      >
        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[195px_minmax(0,1fr)]">
          <nav
            aria-label="Documentation"
            className="flex gap-1 overflow-x-auto border-b border-[#ECEEF1] bg-[#1c1d21] p-3 [scrollbar-width:thin] lg:block lg:border-r lg:border-b-0"
          >
            {entries.map(([key]) => (
              <button
                key={key}
                className={`shrink-0 whitespace-nowrap rounded px-3 py-2 text-left text-xs lg:w-full ${document?.[0] === key ? "bg-[#E5E7EB] font-medium text-[#080B10]" : "text-[#686C76] hover:bg-[#F3F4F6] hover:text-[#080B10]"}`}
                aria-current={document?.[0] === key ? "page" : undefined}
                onClick={() => setSelected(key)}
              >
                {documentLabel(key)}
              </button>
            ))}
          </nav>
          {document ? (
            <article
              key={document[0]}
              className="max-h-[600px] min-w-0 overflow-auto p-5 text-[13px] leading-6 text-[#434955] sm:p-7 [&_h1]:mb-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-[#080B10] [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[#080B10] [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-medium [&_p]:my-3 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1 [&_pre]:my-4 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:border [&_pre]:border-[#ECEEF1] [&_pre]:bg-[#F7F7FA] [&_pre]:p-4 [&_code]:text-xs [&_code]:text-[#6534CC] [&_strong]:font-semibold [&_strong]:text-[#30343E] [&_a]:text-[#6534CC] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#E2E4E9] [&_blockquote]:pl-4"
            >
              <Markdown
                skipHtml
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ node, ...props }) => (
                    <div className="my-4 max-w-full overflow-auto rounded border border-[#E5E7EB]">
                      <table
                        className="w-full border-collapse text-left text-xs leading-5 [&_th]:bg-[#F3F4F6] [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-medium [&_td]:border-t [&_td]:border-[#ECEEF1] [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top"
                        {...props}
                      />
                    </div>
                  ),
                }}
              >
                {document[1]}
              </Markdown>
            </article>
          ) : (
            <Empty compact title="Documentation is being prepared" />
          )}
        </div>
      </Panel>
      {result && (
        <Panel title="Analysis limitations" className="mt-4">
          <ul className="list-disc space-y-2 px-9 py-5 text-xs leading-5 text-[#686C76]">
            {result.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
