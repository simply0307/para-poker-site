"use client";

import { useEffect, useRef, useState } from "react";
import { hasRichTextMarkup, plainTextToHtml, sanitizeRichText } from "@/lib/newsroom/richText";

const fonts = [
  ["Arial, Helvetica, sans-serif", "Arial"],
  ["Georgia, serif", "Georgia"],
  ["'Times New Roman', Times, serif", "Times"],
  ["Verdana, Geneva, sans-serif", "Verdana"],
  ["'Courier New', Courier, monospace", "Mono"],
];

const sizes = ["16px", "18px", "20px", "24px", "28px"];
const colors = ["#18181b", "#92400e", "#991b1b", "#1f2937", "#f8fafc"];

export function RichTextEditor({ label = "Body", value = "", onChange, minHeight = 280 }) {
  const editorRef = useRef(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState(value || "");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || sourceMode) return;
    const nextHtml = hasRichTextMarkup(value) ? sanitizeRichText(value) : plainTextToHtml(value);
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
    setSourceText(value || "");
  }, [sourceMode, value]);

  function emit() {
    const html = sanitizeRichText(editorRef.current?.innerHTML || "");
    onChange?.(html);
    setSourceText(html);
  }

  function exec(command, detail = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, detail);
    emit();
  }

  function applyBlock(block) {
    exec("formatBlock", block);
  }

  function applyStyle(style) {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("fontName", false, style.fontFamily || "");
    if (style.fontSize) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount) {
        const span = document.createElement("span");
        span.style.fontSize = style.fontSize;
        const range = selection.getRangeAt(0);
        span.appendChild(range.extractContents());
        range.insertNode(span);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    emit();
  }

  function addLink() {
    const href = window.prompt("Link URL");
    if (!href) return;
    exec("createLink", href);
  }

  function updateSource(nextValue) {
    setSourceText(nextValue);
    onChange?.(sanitizeRichText(nextValue));
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Rich text</p>
          <h3 className="text-lg font-black text-zinc-950">{label}</h3>
        </div>
        <button type="button" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-black" onClick={() => setSourceMode((current) => !current)}>
          {sourceMode ? "Visual Editor" : "HTML Source"}
        </button>
      </div>

      {!sourceMode ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
            <button type="button" className="toolbarButton" onClick={() => exec("bold")}>B</button>
            <button type="button" className="toolbarButton italic" onClick={() => exec("italic")}>I</button>
            <button type="button" className="toolbarButton underline" onClick={() => exec("underline")}>U</button>
            <button type="button" className="toolbarButton" onClick={() => exec("insertUnorderedList")}>List</button>
            <button type="button" className="toolbarButton" onClick={() => exec("insertOrderedList")}>1. List</button>
            <button type="button" className="toolbarButton" onClick={addLink}>Link</button>
            <select className="toolbarSelect" onChange={(event) => applyBlock(event.target.value)} defaultValue="p" aria-label="Block style">
              <option value="p">Paragraph</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="blockquote">Quote</option>
            </select>
            <select className="toolbarSelect" onChange={(event) => applyStyle({ fontFamily: event.target.value })} defaultValue="" aria-label="Font family">
              <option value="">Font</option>
              {fonts.map(([valueOption, labelOption]) => (
                <option key={valueOption} value={valueOption}>{labelOption}</option>
              ))}
            </select>
            <select className="toolbarSelect" onChange={(event) => applyStyle({ fontSize: event.target.value })} defaultValue="" aria-label="Font size">
              <option value="">Size</option>
              {sizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <select className="toolbarSelect" onChange={(event) => exec("foreColor", event.target.value)} defaultValue="" aria-label="Text color">
              <option value="">Color</option>
              {colors.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
            <button type="button" className="toolbarButton" onClick={() => exec("justifyLeft")}>Left</button>
            <button type="button" className="toolbarButton" onClick={() => exec("justifyCenter")}>Center</button>
          </div>
          <div
            ref={editorRef}
            className="mt-3 rounded-md border border-zinc-300 bg-white p-4 leading-8 text-zinc-950 outline-none focus:border-amber-600"
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            onBlur={emit}
            style={{ minHeight }}
          />
        </>
      ) : (
        <textarea
          className="mt-4 min-h-72 w-full rounded-md border border-zinc-300 p-3 font-mono text-sm text-zinc-950"
          value={sourceText}
          onChange={(event) => updateSource(event.target.value)}
        />
      )}

      <style jsx>{`
        .toolbarButton,
        .toolbarSelect {
          border: 1px solid #d4d4d8;
          border-radius: 6px;
          background: #fff;
          color: #18181b;
          font-size: 0.85rem;
          font-weight: 800;
          padding: 0.45rem 0.65rem;
        }
        .toolbarButton:hover,
        .toolbarSelect:hover {
          border-color: #d97706;
        }
      `}</style>
    </section>
  );
}
