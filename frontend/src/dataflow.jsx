import React, { useState } from "react";
import { Panel, Table, ModuleStatus, Coverage, Unavailable, Empty } from "./ui";

export default function DataFlow({ module, onLocation }) {
  const [functionId, setFunctionId] = useState(""),
    [analysis, setAnalysis] = useState("liveVariables"),
    [round, setRound] = useState(0);
  if (!module?.data?.length)
    return <Unavailable module={module} label="Data flow" />;
  const fn =
    module.data.find((f) => f.functionId === functionId) || module.data[0];
  const definitions = new Map(fn.definitions.map((d) => [d.id, d]));
  const facts = new Map(fn.blocks.map((b) => [b.blockId, b]));
  const selected = fn[analysis];
  const showValue = (v) => fn.valueLabels[v] || v;
  const showSet = (values) =>
    values.length
      ? values
          .map((v) => {
            if (analysis === "liveVariables") return showValue(v);
            const d = definitions.get(v);
            return `${showValue(d?.value || v)} ← ${d?.range ? `line ${d.range.line} (${d.instructionId})` : "entry unknown"}${d?.kind === "MAY_WRITE" ? " [possible write]" : d?.kind === "UNINITIALIZED" ? " [uninitialized]" : ""}`;
          })
          .join("; ")
      : "∅";
  const trace = selected?.trace[Math.min(round, selected.trace.length - 1)];
  return (
    <Panel
      title="Data flow"
      subtitle="Computed on original TAC, before constants replace source uses."
      actions={<ModuleStatus module={module} />}
    >
      <div className="space-y-4 p-4 text-xs leading-6 text-[#434955]">
        <label className="flex flex-wrap items-center gap-3">
          Function
          <select
            aria-label="Data flow function"
            value={fn.functionId}
            onChange={(e) => {
              setFunctionId(e.target.value);
              setRound(0);
            }}
            className="max-w-full rounded-lg border border-[#E5E7EB] p-2"
          >
            {module.data.map((f) => (
              <option key={f.functionId} value={f.functionId}>
                {f.functionName} · {f.status.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        {!selected ? (
          <Empty compact title="Data flow withheld" detail={fn.reason} />
        ) : (
          <>
            <div
              className="flex flex-wrap gap-2"
              aria-label="Data flow analysis"
            >
              {[
                ["liveVariables", "Live variables"],
                ["reachingDefinitions", "Reaching definitions"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={analysis === key}
                  onClick={() => {
                    setAnalysis(key);
                    setRound(0);
                  }}
                  className={`rounded-full px-3 py-2 ${analysis === key ? "bg-[#F0EAFF] text-[#6534CC]" : "bg-[#F3F4F6]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p>
              {analysis === "liveVariables"
                ? "A value is live when a later instruction may read it before another definite write. This analysis works backward from uses."
                : "A definition is a write to a value. This analysis works forward to find which writes may reach a block before another definite write replaces them."}
            </p>
            <div className="rounded-xl bg-[#F7F5FF] p-3">
              <p className="font-medium text-[#6534CC]">
                Fixed point reached in {selected.rounds} rounds
              </p>
              <code className="mt-2 block whitespace-pre-wrap break-words">
                {selected.equation}
              </code>
              <p className="mt-2">
                IN means before a block; OUT means after it. Union combines
                possible paths. Each round reads the previous round’s sets. A
                fixed point means another round changed nothing.
              </p>
            </div>
            <Table
              columns={[
                {
                  key: "blockId",
                  label: "Block",
                  render: (r) =>
                    `${facts.get(r.blockId)?.label}${facts.get(r.blockId)?.reachable ? "" : " · unreachable"}`,
                },
                {
                  key: "in",
                  label: "IN",
                  render: (r) => (
                    <span className="break-words">{showSet(r.in)}</span>
                  ),
                },
                {
                  key: "out",
                  label: "OUT",
                  render: (r) => (
                    <span className="break-words">{showSet(r.out)}</span>
                  ),
                },
              ]}
              rows={selected.blocks}
            />
            <details className="rounded-xl border border-[#E5E7EB] p-3">
              <summary className="cursor-pointer font-medium">
                Block transfer facts
              </summary>
              <p className="mt-2">
                USE: reads before a definite write. DEF: definite writes. GEN:
                writes that survive this block. KILL: older writes replaced in
                this block. Possible memory writes add definitions without
                killing earlier ones.
              </p>
              <Table
                columns={[
                  { key: "label", label: "Block" },
                  ...(analysis === "liveVariables"
                    ? ["use", "def"]
                    : ["gen", "kill"]
                  ).map((key) => ({
                    key,
                    label: key.toUpperCase(),
                    render: (r) => showSet(r[key]),
                  })),
                ]}
                rows={fn.blocks}
              />
            </details>
            <details className="rounded-xl border border-[#E5E7EB] p-3">
              <summary className="cursor-pointer font-medium">
                Iteration trace
              </summary>
              <label className="mt-3 flex flex-wrap items-center gap-3">
                Round
                <select
                  aria-label="Data flow round"
                  value={Math.min(round, selected.trace.length - 1)}
                  onChange={(e) => setRound(Number(e.target.value))}
                  className="rounded-lg border border-[#E5E7EB] p-2"
                >
                  {selected.trace.map((t, i) => (
                    <option key={t.round} value={i}>
                      {t.round} · {t.changedBlocks.length} changed blocks
                    </option>
                  ))}
                </select>
              </label>
              <Table
                columns={[
                  {
                    key: "blockId",
                    label: "Changed block",
                    render: (r) => facts.get(r.blockId)?.label,
                  },
                  { key: "in", label: "IN", render: (r) => showSet(r.in) },
                  { key: "out", label: "OUT", render: (r) => showSet(r.out) },
                ]}
                rows={trace?.changedBlocks || []}
                empty="No changes: the sets have reached a fixed point."
              />
              {selected.traceTruncated && (
                <p role="status">
                  The trace was shortened to its display budget. Final sets are
                  converged and complete.
                </p>
              )}
            </details>
            {analysis === "reachingDefinitions" && (
              <details className="rounded-xl border border-[#E5E7EB] p-3">
                <summary className="cursor-pointer font-medium">
                  Definition source locations
                </summary>
                <Table
                  columns={[
                    {
                      key: "value",
                      label: "Value",
                      render: (r) => showValue(r.value),
                    },
                    { key: "kind", label: "Kind" },
                    { key: "id", label: "Definition ID" },
                    {
                      key: "range",
                      label: "Source",
                      render: (r) =>
                        r.range ? (
                          <button
                            className="text-[#6534CC] hover:underline"
                            onClick={() => onLocation(r.range)}
                          >
                            Line {r.range.line}
                          </button>
                        ) : (
                          "Unknown incoming value"
                        ),
                    },
                  ]}
                  rows={fn.definitions}
                />
              </details>
            )}
          </>
        )}
      </div>
      <Coverage module={module} />
    </Panel>
  );
}
