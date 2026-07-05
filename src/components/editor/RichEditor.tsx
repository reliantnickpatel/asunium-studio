"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import UnderlineExtension from "@tiptap/extension-underline";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import Link from "next/link";
import AsuniumLogo from "@/components/AsuniumLogo";
import {
  Download,
  Save,
  Check,
  Loader2,
  FilePlus2,
  Home,
} from "lucide-react";

import { ResizableImage } from "./ResizableImage";
import { PageBreak } from "./PageBreak";
import EditorToolbar from "./EditorToolbar";
import { exportHtmlToDocx } from "@/lib/editor/exportDocx";
import { templates, TEMPLATE_LABELS, type TemplateKey } from "@/lib/editor/templates";
import { getDoc, saveDoc, type StoredDoc } from "@/lib/persistence";

type SaveState = "idle" | "saving" | "saved";

export default function RichEditor() {
  const [docId, setDocId] = useState(() => nanoid(10));
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
      UnderlineExtension,
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
      attributes: { class: "tiptap doc-page-stack thin-scroll" },
    },
    onUpdate: ({ editor }) => {
      setWords(editor.getText().trim().split(/\s+/).filter(Boolean).length);
      scheduleSave();
    },
  });

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

  useEffect(() => {
    if (!editor) return;
    const recentId = new URLSearchParams(window.location.search).get("doc");
    if (!recentId) return;
    let cancelled = false;
    void getDoc(recentId).then((saved) => {
      if (cancelled || !saved || saved.kind !== "editor") return;
      setDocId(saved.id);
      setTitle(saved.title || "Untitled document");
      editor.commands.setContent(saved.data, { emitUpdate: false });
      setWords(editor.getText().trim().split(/\s+/).filter(Boolean).length);
    });
    return () => {
      cancelled = true;
    };
  }, [editor]);

  const editLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const onExport = useCallback(async () => {
    if (!editor) return;
    setExporting(true);
    try {
      await exportHtmlToDocx(editor.getHTML(), title || "document");
    } finally {
      setExporting(false);
    }
  }, [editor, title]);

  useEffect(() => {
    if (!editor) return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) void onExport();
        else void doSave();
        return;
      }

      if (key === "k") {
        event.preventDefault();
        editLink();
        return;
      }

      if (event.altKey && event.code === "Digit0") {
        event.preventDefault();
        editor.chain().focus().setParagraph().run();
        return;
      }

      if (event.altKey && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
        event.preventDefault();
        const level = Number(event.code.replace("Digit", "")) as 1 | 2 | 3;
        editor.chain().focus().toggleHeading({ level }).run();
        return;
      }

      if (event.shiftKey && event.code === "Digit7") {
        event.preventDefault();
        editor.chain().focus().toggleOrderedList().run();
        return;
      }

      if (event.shiftKey && event.code === "Digit8") {
        event.preventDefault();
        editor.chain().focus().toggleBulletList().run();
        return;
      }

      if (event.shiftKey && key === "x") {
        event.preventDefault();
        editor.chain().focus().toggleStrike().run();
        return;
      }

      if (event.altKey && key === "b") {
        event.preventDefault();
        editor.chain().focus().toggleBlockquote().run();
        return;
      }

      if (event.altKey && key === "h") {
        event.preventDefault();
        editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run();
        return;
      }

      if (event.altKey && key === "t") {
        event.preventDefault();
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        return;
      }

      if (event.shiftKey && ["l", "e", "r", "j"].includes(key)) {
        event.preventDefault();
        const align = key === "l" ? "left" : key === "e" ? "center" : key === "r" ? "right" : "justify";
        editor.chain().focus().setTextAlign(align).run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave, editLink, editor, onExport]);

  if (!editor) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" /> &nbsp;Loading editor…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#dfe3e7]">
      <div className="studio-appbar flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#171a20] px-3 text-slate-300 sm:gap-3 sm:px-4">
        <Link href="/" title="Workspace" aria-label="Workspace" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10 hover:text-white">
          <Home size={17} />
        </Link>
        <span className="h-6 w-px bg-white/10" />
        <div className="flex min-w-0 items-center gap-2">
          <AsuniumLogo size={34} markClassName="bg-[#252525]" />
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave();
            }}
            aria-label="Document title"
            className="min-w-0 max-w-52 bg-transparent px-1 py-1 text-sm font-medium text-white outline-none placeholder:text-slate-500 hover:bg-white/5 focus:bg-white/10 sm:w-56"
          />
        </div>

        <div className="hidden items-center gap-1.5 text-sm sm:flex">
          <FilePlus2 size={15} className="text-slate-500" />
          <select
            onChange={(e) => loadTemplate(e.target.value as TemplateKey)}
            defaultValue=""
            aria-label="Document template"
            className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-slate-300 outline-none hover:bg-white/10 focus:border-[#5c80dc]"
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

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            {saveState === "saving" && <Loader2 size={13} className="animate-spin" />}
            {saveState === "saved" && <Check size={13} className="text-green-600" />}
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
          </span>
          <button
            onClick={doSave}
            title="Save document (Ctrl/Cmd+S)"
            aria-label="Save document"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Save size={16} />
          </button>
          <button
            onClick={onExport}
            disabled={exporting}
            title="Export DOCX (Ctrl/Cmd+Shift+S)"
            className="flex h-9 items-center gap-2 rounded-md bg-[#3867d6] px-3 text-sm font-medium text-white hover:bg-[#2f58bd] disabled:opacity-60"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">Export DOCX</span>
          </button>
        </div>
      </div>

      <div className="studio-toolbar-in thin-scroll shrink-0 overflow-x-auto border-b border-[#cfd4d9] bg-[#f7f8f9]">
        <EditorToolbar editor={editor} />
      </div>

      <div className="studio-canvas-enter studio-canvas-grid thin-scroll flex-1 overflow-auto py-8">
        <div className="doc-canvas">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="flex h-7 items-center justify-between border-t border-[#cfd4d9] bg-[#f7f8f9] px-4 text-[11px] text-slate-500">
        <span>{words} words</span>
        <span className="hidden sm:inline">Local autosave</span>
      </div>
    </div>
  );
}
