"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import Link from "next/link";
import {
  Download,
  Save,
  Check,
  Loader2,
  FileText,
  ArrowLeft,
  FilePlus2,
} from "lucide-react";

import { ResizableImage } from "./ResizableImage";
import { PageBreak } from "./PageBreak";
import EditorToolbar from "./EditorToolbar";
import { exportHtmlToDocx } from "@/lib/editor/exportDocx";
import { templates, TEMPLATE_LABELS, type TemplateKey } from "@/lib/editor/templates";
import { saveDoc, getDoc, type StoredDoc } from "@/lib/persistence";

type SaveState = "idle" | "saving" | "saved";

export default function RichEditor() {
  const [docId, setDocId] = useState<string>("");
  const [title, setTitle] = useState("Untitled document");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [exporting, setExporting] = useState(false);
  const [words, setWords] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ResizableImage.configure({ inline: true, allowBase64: true }),
      PageBreak,
      Placeholder.configure({
        placeholder: "Start writing, or pick a template above…",
      }),
    ],
    content: templates.resume,
    editorProps: {
      attributes: { class: "tiptap doc-page thin-scroll" },
    },
    onUpdate: ({ editor }) => {
      setWords(editor.getText().trim().split(/\s+/).filter(Boolean).length);
      scheduleSave();
    },
  });

  // Initialize id + load last doc / restore
  useEffect(() => {
    const id = nanoid(10);
    setDocId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSave = useCallback(async () => {
    if (!editor || !docId) return;
    setSaveState("saving");
    const doc: StoredDoc = {
      id: docId,
      kind: "editor",
      title,
      data: editor.getHTML(),
      updatedAt: new Date().toISOString(),
    };
    await saveDoc(doc);
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1500);
  }, [editor, docId, title]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 900);
  }, [doSave]);

  const loadTemplate = (key: TemplateKey) => {
    if (!editor) return;
    editor.commands.setContent(templates[key]);
    setTitle(TEMPLATE_LABELS[key] === "Blank" ? "Untitled document" : `${TEMPLATE_LABELS[key]} document`);
    setWords(editor.getText().trim().split(/\s+/).filter(Boolean).length);
    scheduleSave();
  };

  const onExport = async () => {
    if (!editor) return;
    setExporting(true);
    try {
      await exportHtmlToDocx(editor.getHTML(), title || "document");
    } finally {
      setExporting(false);
    }
  };

  if (!editor) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" /> &nbsp;Loading editor…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar (sticky) */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Home
        </Link>
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-600" />
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave();
            }}
            className="w-56 rounded-md border border-transparent px-2 py-1 text-sm font-medium hover:border-slate-200 focus:border-blue-400 focus:outline-none"
          />
        </div>

        {/* Template selector */}
        <div className="flex items-center gap-1.5 text-sm">
          <FilePlus2 size={15} className="text-slate-400" />
          <select
            onChange={(e) => loadTemplate(e.target.value as TemplateKey)}
            defaultValue=""
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 focus:outline-none"
          >
            <option value="" disabled>
              Template…
            </option>
            {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            {saveState === "saving" && <Loader2 size={13} className="animate-spin" />}
            {saveState === "saved" && <Check size={13} className="text-green-600" />}
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
          </span>
          <button
            onClick={doSave}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Save size={15} /> Save
          </button>
          <button
            onClick={onExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Export DOCX
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <EditorToolbar editor={editor} />
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-slate-100 py-8 thin-scroll">
        <EditorContent editor={editor} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-400">
        <span>{words} words</span>
        <span>Autosaves locally · syncs to server when available</span>
      </div>
    </div>
  );
}
