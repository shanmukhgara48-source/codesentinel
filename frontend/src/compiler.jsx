import React, { useState } from "react";
import {
  Panel,
  Table,
  ModuleStatus,
  Coverage,
  Unavailable,
  Diagnostics,
  muted,
  tabKeys,
} from "./ui";
import DataFlow from "./dataflow";
import { StageHint } from "./beginner";
import { AstExplorer, Cfg } from "./graphs";
const tabs = [
  "Tokens",
  "AST",
  "Symbols",
  "Semantics",
  "TAC & optimization",
  "CFG",
  "Data flow",
];
export default function Compiler({
  result,
  onLocation,
  initialTab = "Tokens",
  stages = tabs,
}) {
  const [tab, setTab] = useState(initialTab),
    [tokenType, setTokenType] = useState("ALL"),
    [libraries, setLibraries] = useState(false),
    [functionId, setFunctionId] = useState("");
  const modules = result.modules,
    tokens = modules.tokens?.data || [],
    tac = modules.tac?.data || [],
    optimized = modules.optimization?.data;
  const selected = tac.find((f) => f.id === functionId) || tac[0],
    after = optimized?.functions?.find((f) => f.id === selected?.id),
    changes =
      optimized?.changes?.filter((c) =>
        selected?.instructions?.some((i) => i.id === c.instructionId),
      ) || [];
  return (
    <>
      {stages.length > 1 && (
        <div
          className="mb-5 flex flex-wrap gap-x-5 gap-y-1 border-b border-[#E5E7EB]"
          role="tablist"
          aria-label="Compiler stages"
          onKeyDown={tabKeys}
        >
          {stages.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              className={`border-b-2 px-0.5 py-3 text-[13px] transition-colors ${tab === t ? "border-[#7947FF] font-medium text-[#080B10]" : "border-transparent text-[#686C76] hover:text-[#080B10]"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <StageHint stage={tab} />
      {tab === "Tokens" && (
        <Panel
          title="Lexer token stream"
          subtitle={`${tokens.length} inspectable tokens · ${result.summary.tokenCount} significant tokens`}
          actions={
            <select
              aria-label="Token category"
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value)}
              className="rounded border border-[#E5E7EB] bg-[#F7F7FA] p-2 text-xs"
            >
              {["ALL", ...new Set(tokens.map((t) => t.category))].map((t) => (
                <option key={t} value={t}>
                  {t === "ALL" ? "All categories" : t}
                </option>
              ))}
            </select>
          }
        >
          <div className="max-h-[540px] overflow-auto">
            <Table
              columns={[
                {
                  key: "text",
                  label: "Lexeme",
                  render: (r) => (
                    <code className="whitespace-pre-wrap break-all text-[#434955]">
                      {r.text}
                    </code>
                  ),
                },
                { key: "category", label: "Category" },
                { key: "type", label: "Grammar token" },
                {
                  key: "location",
                  label: "Location",
                  render: (r) => (
                    <button
                      onClick={() => onLocation(r.range)}
                      className="whitespace-nowrap text-[#6534CC] hover:underline"
                    >
                      {r.range.line}:{r.range.column}
                    </button>
                  ),
                },
              ]}
              rows={tokens.filter(
                (t) => tokenType === "ALL" || t.category === tokenType,
              )}
            />
          </div>
          <Coverage module={modules.tokens} />
        </Panel>
      )}
      {tab === "AST" && (
        <AstExplorer
          key={result.analysisId}
          module={modules.ast}
          result={result}
          onLocation={onLocation}
        />
      )}{" "}
      {tab === "Symbols" &&
        (modules.symbols?.data ? (
          <Panel
            title="Scoped symbol table"
            subtitle="Source identifiers have stable IDs; references distinguish shadowed variables."
            actions={
              <label className="flex items-center gap-2 text-xs text-[#686C76]">
                <input
                  type="checkbox"
                  checked={libraries}
                  onChange={(e) => setLibraries(e.target.checked)}
                />
                Show library catalog
              </label>
            }
          >
            <Table
              columns={[
                {
                  key: "name",
                  label: "Identifier",
                  render: (r) => (
                    <code className="text-[#6534CC]">{r.name}</code>
                  ),
                },
                { key: "id", label: "Symbol ID" },
                { key: "category", label: "Category" },
                {
                  key: "type",
                  label: "Declared type",
                  render: (r) =>
                    r.type +
                    "*".repeat(r.pointerDepth) +
                    (r.arrayDimensions?.length
                      ? "[" + r.arrayDimensions.join("][") + "]"
                      : ""),
                },
                { key: "scope", label: "Scope" },
                {
                  key: "range",
                  label: "Declaration",
                  render: (r) =>
                    r.range ? (
                      <button
                        className="text-[#6534CC] hover:underline"
                        onClick={() => onLocation(r.range)}
                      >
                        {r.range.line}:{r.range.column}
                      </button>
                    ) : (
                      "catalog"
                    ),
                },
              ]}
              rows={modules.symbols.data.symbols.filter(
                (s) => libraries || s.origin !== "LIBRARY",
              )}
            />
            <details className="border-t border-[#ECEEF1]">
              <summary className="cursor-pointer px-5 py-3 text-xs text-[#686C76]">
                {modules.symbols.data.references.length} resolved source
                references
              </summary>
              <Table
                columns={[
                  { key: "name", label: "Use" },
                  { key: "symbolId", label: "Resolved symbol ID" },
                  { key: "nodeId", label: "AST node" },
                  {
                    key: "range",
                    label: "Source",
                    render: (r) => (
                      <button
                        className="text-[#6534CC] hover:underline"
                        onClick={() => onLocation(r.range)}
                      >
                        {r.range.line}:{r.range.column}
                      </button>
                    ),
                  },
                ]}
                rows={modules.symbols.data.references}
              />
            </details>
            <Coverage module={modules.symbols} />
          </Panel>
        ) : (
          <Unavailable module={modules.symbols} label="Symbol table" />
        ))}
      {tab === "Semantics" &&
        (modules.semantics?.data ? (
          <Panel
            title="Semantic diagnostics"
            actions={<ModuleStatus module={modules.semantics} />}
          >
            <Diagnostics
              items={modules.semantics.data}
              onLocation={onLocation}
            />
            <Coverage module={modules.semantics} />
          </Panel>
        ) : (
          <Unavailable
            module={modules.semantics}
            label="Semantic diagnostics"
          />
        ))}
      {tab === "TAC & optimization" &&
        (selected ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <select
                aria-label="TAC function"
                value={selected.id}
                onChange={(e) => setFunctionId(e.target.value)}
                className="rounded border border-[#E5E7EB] bg-[#F7F7FA] p-2 text-xs"
              >
                {tac.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.status.toLowerCase()}
                  </option>
                ))}
              </select>
              <p className={`text-xs ${muted}`}>
                {optimized.beforeCount} → {optimized.afterCount} operational
                instructions across assessed functions
              </p>
            </div>
            {selected.instructions ? (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    ["Original TAC", selected.instructions],
                    ["Optimized TAC", after.instructions],
                  ].map(([title, instructions]) => (
                    <Panel
                      key={title}
                      title={title}
                      subtitle={`${instructions.filter((i) => !["DECLARE", "LABEL"].includes(i.op)).length} operational instructions`}
                    >
                      <div className="max-h-[470px] overflow-auto bg-[#F7F7FA] p-3 font-mono text-xs leading-6">
                        {instructions.map((i, index) => (
                          <div
                            key={i.id}
                            className={`flex gap-3 rounded px-2 ${title === "Optimized TAC" && changes.some((c) => c.instructionId === i.id) ? "bg-[#7947FF]/8 text-[#6534CC]" : "text-[#434955]"}`}
                          >
                            <span className="w-5 shrink-0 select-none text-right text-[#8B8F99]">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <button
                                onClick={() => onLocation(i.range)}
                                className="whitespace-pre text-left hover:text-[#6534CC]"
                                aria-label={`View instruction ${i.id} in source`}
                              >
                                {i.text}
                              </button>
                              <details className="font-sans text-[10px] leading-5 text-[#686C76]">
                                <summary className="cursor-pointer">
                                  Operands & effects · AST {i.nodeId}
                                </summary>
                                <p>
                                  {i.operands
                                    ?.map((o) => `${o.ref}: ${o.type}`)
                                    .join(" · ") || "No value operands"}
                                </p>
                                <p>
                                  Uses: {i.effects?.uses.join(", ") || "∅"};
                                  defines:{" "}
                                  {i.effects?.defines.join(", ") || "∅"}
                                </p>
                                <p>
                                  {[
                                    i.effects?.calls && "call",
                                    i.effects?.readsMemory && "reads memory",
                                    i.effects?.writesMemory && "writes memory",
                                    i.effects?.volatileAccess && "volatile",
                                    i.effects?.mayTrap && "may trap",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") ||
                                    "No modeled external effect"}
                                </p>
                              </details>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ))}
                </div>
                <Panel
                  title="Transformation log"
                  subtitle="Each entry records an actual backend rewrite and its validity reason."
                  className="mt-4"
                >
                  <Table
                    columns={[
                      {
                        key: "pass",
                        label: "Pass",
                        render: (r) => r.pass.replaceAll("_", " "),
                      },
                      {
                        key: "before",
                        label: "Before",
                        render: (r) => <code>{r.before}</code>,
                      },
                      {
                        key: "after",
                        label: "After",
                        render: (r) => (
                          <code className="text-[#6534CC]">{r.after}</code>
                        ),
                      },
                      { key: "reason", label: "Why valid" },
                      {
                        key: "range",
                        label: "Source",
                        render: (r) => (
                          <button
                            className="text-[#6534CC] hover:underline"
                            onClick={() => onLocation(r.range)}
                          >
                            Line {r.range.line}
                          </button>
                        ),
                      },
                    ]}
                    rows={changes}
                    empty="No conservative rewrite applied to this function."
                  />
                  {optimized.diagnostics.length > 0 && (
                    <Diagnostics
                      items={optimized.diagnostics}
                      onLocation={onLocation}
                    />
                  )}
                  <Coverage module={modules.optimization} />
                </Panel>
              </>
            ) : (
              <Panel title="TAC withheld">
                <Diagnostics
                  items={selected.diagnostics}
                  onLocation={onLocation}
                />
              </Panel>
            )}
          </>
        ) : (
          <Unavailable module={modules.tac} label="TAC & optimization" />
        ))}
      {tab === "CFG" && (
        <Cfg
          key={result.analysisId}
          module={modules.cfg}
          onLocation={onLocation}
        />
      )}{" "}
      {tab === "Data flow" && (
        <DataFlow module={modules.dataFlow} onLocation={onLocation} />
      )}
    </>
  );
}
