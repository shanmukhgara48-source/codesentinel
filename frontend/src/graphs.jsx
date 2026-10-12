import React, { useRef, useState } from "react";
import { ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
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
export function AstExplorer({ module, onLocation }) {
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
  if (!module?.data?.length)
    return <Unavailable module={module} label="Control-flow graph" />;
  const graph =
    module.data.find((g) => g.functionId === functionId) || module.data[0];
  const block = graph.nodes.find((n) => n.id === selected) || graph.nodes[0];
  const columns = graph.nodes.length > 7 ? 2 : 1,
    w = columns === 2 ? 720 : 420;
  const positions = Object.fromEntries(
    graph.nodes.map((n, i) => [
      n.id,
      {
        x: columns === 2 ? 55 + (i % 2) * 340 : 90,
        y: 35 + Math.floor(i / columns) * 140,
      },
    ]),
  );
  const height = Math.ceil(graph.nodes.length / columns) * 140 + 30;
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
        <span>Drag canvas to pan</span>
        <div className="flex items-center gap-2">
          <button
            aria-label="Zoom out"
            disabled={zoom <= 0.5}
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
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
          className="max-h-[470px] overflow-auto bg-[#F7F7FA] p-3 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            if (
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
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
        >
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
              let path = `M ${startX} ${startY} C ${startX} ${startY + 30} ${endX} ${endY - 30} ${endX} ${endY}`;
              if (e.backEdge) {
                startX = a.x + 230;
                startY = a.y + 46;
                endX = b.x + 230;
                endY = b.y + 46;
                const outside = Math.max(startX, endX) + 40;
                path = `M ${startX} ${startY} C ${outside} ${startY} ${outside} ${endY} ${endX} ${endY}`;
              } else if (a.y === b.y) {
                startX = a.x + 230;
                startY = a.y + 46;
                endX = b.x;
                endY = b.y + 46;
                path = `M ${startX} ${startY} L ${endX} ${endY}`;
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
                  className="cursor-pointer"
                >
                  <rect
                    x={p.x}
                    y={p.y}
                    width="230"
                    height="92"
                    rx="14"
                    fill={block.id === n.id ? "#F0EAFF" : "#FFFFFF"}
                    stroke={block.id === n.id ? "#7947FF" : "#DCDEE5"}
                  />
                  <text
                    x={p.x + 14}
                    y={p.y + 23}
                    fill={block.id === n.id ? "#6534CC" : "#434955"}
                    fontSize="12"
                    fontFamily="monospace"
                  >
                    {n.label} · {n.kind}
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
        </div>
        <div className="border-t border-[#E5E7EB] p-5">
          <p className="text-xs font-medium text-[#686C76]">Block inspector</p>
          <h3 className="mt-2 font-mono text-lg text-[#6534CC]">
            {block.label}
          </h3>
          <p className={`mt-2 text-xs ${muted}`}>
            {block.instructions.length} TAC records
          </p>
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
