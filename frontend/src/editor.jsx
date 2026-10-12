import React, { useEffect, useRef } from "react";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  lineNumbers,
  keymap,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  placeholder,
} from "@codemirror/view";
import {
  history,
  historyKeymap,
  defaultKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from "@codemirror/language";
const selectLine = StateEffect.define();
const highlightedLine = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    if (tr.docChanged) value = Decoration.none;
    for (const effect of tr.effects)
      if (effect.is(selectLine))
        value =
          effect.value === null
            ? Decoration.none
            : Decoration.set([
                Decoration.line({ class: "source-location" }).range(
                  effect.value,
                ),
              ]);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "#FFFFFF", fontSize: "12px" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
    lineHeight: "25px",
  },
  ".cm-content": { padding: "20px 0", caretColor: "#7947FF" },
  ".cm-line": { padding: "0 20px 0 14px" },
  ".cm-gutters": {
    backgroundColor: "#FFFFFF",
    color: "#686C76",
    border: "none",
    padding: "0 4px 0 12px",
  },
  ".cm-activeLineGutter": { backgroundColor: "#F4F0FF", color: "#7947FF" },
  ".cm-activeLine": { backgroundColor: "#FAF8FF" },
  ".source-location": {
    backgroundColor: "#F0E8FF",
    boxShadow: "inset 3px 0 #7947FF",
  },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "#E5D9FF",
  },
  ".cm-placeholder": { color: "#8B8F99" },
});
export default function CodeEditor({ source, onChange, selected }) {
  const parent = useRef(null),
    view = useRef(null),
    callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    view.current = new EditorView({
      state: EditorState.create({
        doc: source,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          cpp(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          theme,
          highlightedLine,
          placeholder("Paste C source here, or choose a sample above…"),
          EditorView.contentAttributes.of({
            "aria-label": "C source",
            "aria-multiline": "true",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              callback.current(update.state.doc.toString());
          }),
        ],
      }),
      parent: parent.current,
    });
    return () => view.current.destroy();
  }, []);
  useEffect(() => {
    const current = view.current;
    if (current && source !== current.state.doc.toString())
      current.dispatch({
        changes: { from: 0, to: current.state.doc.length, insert: source },
      });
  }, [source]);
  useEffect(() => {
    const current = view.current;
    if (!current) return;
    if (!selected) {
      current.dispatch({ effects: selectLine.of(null) });
      return;
    }
    const line = current.state.doc.line(
      Math.min(Math.max(1, selected.line), current.state.doc.lines),
    );
    const from = Math.min(
        current.state.doc.length,
        Math.max(0, selected.startOffset ?? line.from),
      ),
      to = Math.min(
        current.state.doc.length,
        Math.max(from, selected.endOffset ?? line.to),
      );
    current.dispatch({
      selection: { anchor: from, head: to },
      effects: [
        selectLine.of(line.from),
        EditorView.scrollIntoView(from, { y: "center" }),
      ],
    });
    current.focus();
  }, [selected]);
  return (
    <div
      ref={parent}
      className="h-[430px] min-w-0 text-[#30323A] lg:h-[635px]"
    />
  );
}
