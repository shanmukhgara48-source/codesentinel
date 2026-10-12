import React, { useMemo, useRef, useState } from "react";
import { ChevronRight, Minus, Plus, RotateCcw, Maximize2 } from "lucide-react";
import { Panel, Table, ModuleStatus, Coverage, muted, Unavailable } from "./ui";
function TreeNode({ node, depth, onSelect, selected }) {
  const [open, setOpen] = useState(depth < 2);
  return (
    <div>
      <div
        className={`flex items-center rounded px-2 py-1.5 text-xs ${selected === node.id ? "bg-[#7947FF]/10 text-[#6534CC]" : "text-[#434955] hover:bg-[#F3F4F6]"}`}
      >
        <button
          aria-label={`${open ? "Collapse" : "Expand"} ${node.kind} ${node.attributes.name || ""}`}
          onClick={() => setOpen(!open)}
          className={`mr-1 shrink-0 ${!node.children.length ? "invisible" : ""}`}
        >
          <ChevronRight size={12} className={open ? "rotate-90" : ""} />
        </button>
        <button
          aria-label={`${node.kind} ${node.attributes.name || ""}`.trim()}
          className="min-w-0 truncate text-left font-mono"
          onClick={() => onSelect(node)}
        >
          {node.kind}
          {node.attributes.name && (
            <span className="ml-2 text-[#686C76]">{node.attributes.name}</span>
          )}
        </button>
        {node.kind === "Unsupported" && (
          <span className="ml-2 text-[9px] text-[#725300]">LIMITED</span>
        )}
      </div>
      {open && node.children.length > 0 && (
        <div className="ml-3 border-l border-[#E5E7EB] pl-2">
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
export function AstExplorer({ module, onLocation, result }) {
  const [selected, setSelected] = useState(null);
  if (!module?.data) return <Unavailable module={module} label="AST" />;
  const node = selected || module.data;
  return (
    <Panel
      title="Simplified AST"
      subtitle="Inspect structure, attributes, and source ranges."
      actions={<ModuleStatus module={module} />}
    >
      <div className="grid min-h-96 grid-cols-1 divide-[#E5E7EB]">
        <div className="max-h-[520px] overflow-auto p-4">
          <TreeNode
            key={module.data.id + module.data.range.endOffset}
            node={module.data}
            depth={0}
            onSelect={setSelected}
            selected={node.id}
          />
        </div>
        <div className="border-t border-[#E5E7EB] p-5">
          <p className="text-xs font-medium text-[#686C76]">Selected node</p>
          <h3 className="mt-2 font-mono text-base text-[#6534CC]">
            {node.kind}
          </h3>
          <p className={`mt-1 text-xs ${muted}`}>
            {node.id} · {node.children.length} children
          </p>
          <button
            className="mt-4 text-xs text-[#6534CC] hover:underline"
            onClick={() => onLocation(node.range)}
          >
            Line {node.range.line}, column {node.range.column}
          </button>
          {result && (
            <SourceTrace node={node} result={result} onLocation={onLocation} />
          )}
          <pre className="mt-4 overflow-auto rounded-md bg-[#F7F7FA] p-4 text-xs leading-6 text-[#434955]">
            {JSON.stringify(node.attributes, null, 2)}
          </pre>
        </div>
      </div>
      <Coverage module={module} />
    </Panel>
  );
}
export function Cfg({ module, onLocation }) {
  const [functionId, setFunctionId] = useState(""),
    [selected, setSelected] = useState(""),
    [zoom, setZoom] = useState(1);
  const drag = useRef(null),
    viewport = useRef(null);
  const graph =
    module?.data?.find((g) => g.functionId === functionId) || module?.data?.[0];
  const layout = useMemo(() => (graph ? layoutGraph(graph) : null), [graph]);
  if (!module?.data?.length)
    return <Unavailable module={module} label="Control-flow graph" />;
  const block = graph.nodes.find((n) => n.id === selected) || graph.nodes[0];
  const { positions, width: w, height, reachable } = layout;
  return (
    <Panel
      title="Control-flow graph"
      subtitle="Derived from optimized TAC. Select a block to inspect its instructions."
      actions={
        <select
          aria-label="CFG function"
          className="rounded border border-[#E5E7EB] bg-[#F7F7FA] p-2 text-xs"
          value={graph.functionId}
          onChange={(e) => {
            setFunctionId(e.target.value);
            setSelected("");
            setZoom(1);
          }}
        >
          {module.data.map((g) => (
            <option key={g.functionId} value={g.functionId}>
              {g.functionName}
            </option>
          ))}
        </select>
      }
    >
      <div className="flex flex-wrap gap-4 border-b border-[#ECEEF1] px-5 py-3 text-[10px] text-[#686C76]">
        <span className="text-[#6534CC]">● true / entry</span>
        <span className="text-[#A67400]">● false branch</span>
        <span className="text-[#7947FF]">↶ back edge</span>
        <span>● fall-through / jump / return</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-[#ECEEF1] px-4 py-3 text-[10px] text-[#686C76]">
        <label className="min-w-0">
          Inspect block{" "}
          <select
            aria-label="Inspect CFG block"
            value={block.id}
            onChange={(e) => setSelected(e.target.value)}
            className="ml-2 max-w-[130px] rounded border border-[#E5E7EB] bg-white p-1.5"
          >
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
                {reachable.has(n.id) ? "" : " · unreachable"}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            aria-label="Fit graph"
            onClick={() => {
              setZoom(
                Math.max(
                  0.1,
                  Math.min(
                    1,
                    (viewport.current.clientWidth - 24) / w,
                    (viewport.current.clientHeight - 24) / height,
                  ),
                ),
              );
              viewport.current.scrollTo(0, 0);
            }}
            className="rounded-full border border-[#E5E7EB] p-1.5"
          >
            <Maximize2 size={13} />
          </button>
          <button
            aria-label="Zoom out"
            disabled={zoom <= 0.1}
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
            className="rounded-full border border-[#E5E7EB] p-1.5 disabled:opacity-30"
          >
            <Minus size={13} />
          </button>
          <span className="w-9 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            aria-label="Zoom in"
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="rounded-full border border-[#E5E7EB] p-1.5 disabled:opacity-30"
          >
            <Plus size={13} />
          </button>
          <button
            aria-label="Reset graph view"
            onClick={() => {
              setZoom(1);
              viewport.current.scrollTo(0, 0);
            }}
            className="rounded-full border border-[#E5E7EB] p-1.5"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1">
        <div
          ref={viewport}
          tabIndex={0}
          aria-label="Graph canvas, use arrow keys to pan"
          className="max-h-[470px] overflow-auto bg-[#F7F7FA] p-3 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            if (
              e.button !== 0 ||
              e.target.closest('[role="button"]') ||
              e.pointerType === "touch"
            )
              return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              left: e.currentTarget.scrollLeft,
              top: e.currentTarget.scrollTop,
            };
          }}
          onPointerMove={(e) => {
            if (
              !drag.current ||
              !e.currentTarget.hasPointerCapture(e.pointerId)
            )
              return;
            e.currentTarget.scrollLeft =
              drag.current.left - (e.clientX - drag.current.x);
            e.currentTarget.scrollTop =
              drag.current.top - (e.clientY - drag.current.y);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
        >
          {graph.nodes.length > 256 ? (
            <div className="p-5 text-xs leading-6 text-[#686C76]">
              The canvas is unavailable above 256 blocks. Use the block selector
              and inspector to explore the complete CFG.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${w} ${height}`}
              style={{ width: `${w * zoom}px`, height: `${height * zoom}px` }}
              className="max-w-none"
              role="group"
              aria-label={`Control-flow graph for ${graph.functionName}`}
            >
              <defs>
                {["gray", "green", "amber", "blue"].map((c, i) => (
                  <marker
                    key={c}
                    id={`arrow-${c}`}
                    markerWidth="7"
                    markerHeight="7"
                    refX="6"
                    refY="3.5"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L7,3.5 L0,7"
                      fill={["#7d8390", "#7947FF", "#A67400", "#7947FF"][i]}
                    />
                  </marker>
                ))}
              </defs>
              {graph.edges.map((e) => {
                const a = positions[e.source],
                  b = positions[e.target],
                  color = e.backEdge
                    ? "blue"
                    : e.kind === "FALSE"
                      ? "amber"
                      : e.kind === "TRUE" || e.kind === "ENTRY"
                        ? "green"
                        : "gray";
                let startX = a.x + 115,
                  startY = a.y + 92,
                  endX = b.x + 115,
                  endY = b.y;
                let path = `M ${startX} ${startY} C ${startX} ${startY + 28} ${endX} ${endY - 28} ${endX} ${endY}`;
                if (e.backEdge || Math.abs(b.y - a.y) > 170) {
                  const lane = e.backEdge
                    ? w - 25 - (Number(e.id.slice(1)) % 4) * 10
                    : 20 + (Number(e.id.slice(1)) % 4) * 10;
                  startX = e.backEdge ? a.x + 230 : a.x;
                  startY = a.y + 64;
                  endX = e.backEdge ? b.x + 230 : b.x;
                  endY = b.y + 64;
                  path = `M ${startX} ${startY} L ${lane} ${startY} L ${lane} ${endY} L ${endX} ${endY}`;
                }
                return (
                  <g key={e.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={
                        {
                          gray: "#7d8390",
                          green: "#7947FF",
                          amber: "#A67400",
                          blue: "#7947FF",
                        }[color]
                      }
                      strokeWidth="1.5"
                      strokeDasharray={e.backEdge ? "5 3" : undefined}
                      opacity=".7"
                      markerEnd={`url(#arrow-${color})`}
                    />
                    <text
                      x={e.kind === "TRUE" ? startX - 35 : startX + 3}
                      y={e.kind === "TRUE" ? startY + 10 : startY + 23}
                      fontSize="9"
                      fill="#686C76"
                    >
                      {e.kind.replaceAll("_", " ")}
                      {e.backEdge ? " ↶" : ""}
                    </text>
                  </g>
                );
              })}
              {graph.nodes.map((n) => {
                const p = positions[n.id],
                  lines = n.instructions
                    .filter((i) => i.op !== "LABEL")
                    .slice(0, 2);
                return (
                  <g
                    key={n.id}
                    role="button"
                    tabIndex="0"
                    aria-label={`Inspect block ${n.label}`}
                    onClick={() => setSelected(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(n.id);
                      }
                    }}
                    aria-pressed={block.id === n.id}
                    className="cursor-pointer focus:outline-none focus:[&_rect]:stroke-[#080B10] focus:[&_rect]:stroke-[3px]"
                  >
                    <rect
                      x={p.x}
                      y={p.y}
                      width="230"
                      height="92"
                      rx="14"
                      fill={block.id === n.id ? "#F0EAFF" : "#FFFFFF"}
                      stroke={block.id === n.id ? "#7947FF" : "#DCDEE5"}
                      strokeDasharray={reachable.has(n.id) ? undefined : "4 3"}
                    />
                    <text
                      x={p.x + 14}
                      y={p.y + 23}
                      fill={block.id === n.id ? "#6534CC" : "#434955"}
                      fontSize="12"
                      fontFamily="monospace"
                    >
                      {n.label} · {reachable.has(n.id) ? n.kind : "UNREACHABLE"}
                    </text>
                    {lines.map((line, j) => (
                      <text
                        key={line.id}
                        x={p.x + 14}
                        y={p.y + 46 + j * 17}
                        fill="#626874"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {line.text.length > 31
                          ? line.text.slice(0, 30) + "…"
                          : line.text}
                      </text>
                    ))}
                    {!lines.length && (
                      <text
                        x={p.x + 14}
                        y={p.y + 49}
                        fill="#686C76"
                        fontSize="10"
                      >
                        {n.kind === "ENTRY"
                          ? "Function entry"
                          : n.kind === "EXIT"
                            ? "Function exit"
                            : "Label boundary"}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        <div className="border-t border-[#E5E7EB] p-5">
          <p className="text-xs font-medium text-[#686C76]">Block inspector</p>
          <h3 className="mt-2 font-mono text-lg text-[#6534CC]">
            {block.label}
          </h3>
          <p className={`mt-2 text-xs ${muted}`}>
            {block.instructions.length} TAC records
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {graph.edges
              .filter((e) => e.source === block.id || e.target === block.id)
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() =>
                    setSelected(e.source === block.id ? e.target : e.source)
                  }
                  className="rounded-full bg-[#F4F0FF] px-3 py-2 text-[10px] text-[#6534CC]"
                >
                  {e.source === block.id ? "To" : "From"}{" "}
                  {
                    graph.nodes.find(
                      (n) =>
                        n.id === (e.source === block.id ? e.target : e.source),
                    )?.label
                  }{" "}
                  · {e.kind.replaceAll("_", " ")}
                </button>
              ))}
          </div>
          <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-6 text-[#434955]">
            {block.instructions.map((i) => i.text).join("\n") ||
              "No executable instruction in this boundary node."}
          </pre>
          {block.instructions[0]?.range && (
            <button
              className="mt-4 text-xs text-[#6534CC] hover:underline"
              onClick={() => onLocation(block.instructions[0].range)}
            >
              Open source location
            </button>
          )}
          <p className={`mt-6 text-[10px] leading-5 ${muted}`}>
            {graph.nodes.length} nodes · {graph.edges.length} edges.
            Disconnected blocks are retained.
          </p>
        </div>
      </div>
      <Coverage module={module} />
    </Panel>
  );
}

function layoutGraph(graph) {
  const reachable = new Set(),
    pending = [graph.nodes[0].id];
  const outgoing = new Map(graph.nodes.map((n) => [n.id, []]));
  graph.edges.forEach((e) => outgoing.get(e.source).push(e));
  while (pending.length) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    outgoing.get(id).forEach((e) => pending.push(e.target));
  }
  const rank = new Map(graph.nodes.map((n) => [n.id, 0]));
  // Emission-order forward edges form an acyclic layout spine; backward edges use gutters.
  graph.nodes
    .filter((n) => reachable.has(n.id))
    .forEach((n) =>
      outgoing
        .get(n.id)
        .filter((e) => !e.backEdge)
        .forEach((e) =>
          rank.set(e.target, Math.max(rank.get(e.target), rank.get(n.id) + 1)),
        ),
    );
  const lastReachableRank = Math.max(
    ...graph.nodes
      .filter((n) => reachable.has(n.id))
      .map((n) => rank.get(n.id)),
  );
  graph.nodes
    .filter((n) => !reachable.has(n.id))
    .forEach((n, i) =>
      rank.set(n.id, lastReachableRank + 2 + Math.floor(i / 2)),
    );
  const rows = new Map();
  graph.nodes.forEach((n) => {
    const r = rank.get(n.id);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push(n);
  });
  const columns = Math.max(...Array.from(rows.values(), (row) => row.length));
  const width = Math.max(420, columns * 300 + 140),
    positions = {};
  rows.forEach((row, r) =>
    row.forEach((n, column) => {
      positions[n.id] = {
        x: (width - row.length * 300) / 2 + column * 300 + 35,
        y: 30 + r * 160,
      };
    }),
  );
  return {
    positions,
    width,
    height: (Math.max(...rows.keys()) + 1) * 160,
    reachable,
  };
}
function SourceTrace({ node, result, onLocation }) {
  const trace = useMemo(() => {
    const ids = new Set(),
      pending = [node];
    while (pending.length) {
      const n = pending.pop();
      ids.add(n.id);
      pending.push(...n.children);
    }
    const tokens = (result.modules.tokens?.data || []).filter(
      (t) =>
        t.range.startOffset >= node.range.startOffset &&
        t.range.endOffset <= node.range.endOffset,
    );
    const references = (result.modules.symbols?.data?.references || []).filter(
      (r) => ids.has(r.nodeId),
    );
    const instructions = (result.modules.tac?.data || [])
      .flatMap((f) => f.instructions || [])
      .filter((i) => ids.has(i.nodeId));
    const instructionIds = new Set(instructions.map((i) => i.id));
    const blocks = (result.modules.cfg?.data || []).flatMap((g) =>
      g.nodes
        .filter((b) => b.instructions.some((i) => instructionIds.has(i.id)))
        .map((b) => `${g.functionName}: ${b.label}`),
    );
    return { tokens, references, instructions, blocks };
  }, [node, result]);
  return (
    <details className="mt-4 rounded-xl border border-[#E5E7EB] p-3 text-xs leading-6 text-[#434955]">
      <summary className="cursor-pointer font-medium">
        Source connections
      </summary>
      <p className="mt-2">
        {trace.tokens.length} tokens · {trace.references.length} resolved uses ·{" "}
        {trace.instructions.length} TAC records
      </p>
      <p>
        CFG blocks:{" "}
        {trace.blocks.join(", ") || "No published block for this node"}
      </p>
      <p>
        Symbols:{" "}
        {[
          ...new Set(trace.references.map((r) => `${r.name}@${r.symbolId}`)),
        ].join(", ") || "No resolved symbol use"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {trace.tokens.slice(0, 20).map((t) => (
          <button
            key={t.id}
            onClick={() => onLocation(t.range)}
            className="rounded bg-[#F4F0FF] px-2 text-[#6534CC]"
            title={`${t.id} · ${t.type}`}
          >
            <code>{t.text}</code>
          </button>
        ))}
      </div>
      {trace.tokens.length > 20 && (
        <p>
          First 20 tokens shown; all tokens are available in the Tokens tab.
        </p>
      )}
      {trace.instructions.slice(0, 10).map((i) => (
        <button
          key={i.id}
          onClick={() => onLocation(i.range)}
          className="mt-1 block max-w-full overflow-auto text-left text-[#6534CC]"
        >
          <code>
            {i.id} · {i.text}
          </code>
        </button>
      ))}
      {trace.instructions.length > 10 && (
        <p>
          First 10 instructions shown; all instructions are available in
          Optimization.
        </p>
      )}
    </details>
  );
}
