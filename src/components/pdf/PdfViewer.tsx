"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileUp, Loader2, Save, Check, FileText } from "lucide-react";
import { loadPdf, getPageSizes, type PDFDocumentProxy, type PageSize } from "./pdfjs";
import PdfPage from "./PdfPage";
import PdfToolbar from "./PdfToolbar";
import KonvaAnnotations from "./konva/KonvaAnnotations";
import { usePdfStore, type ToolId } from "./store";
import { useStage } from "./useStage";
import { saveDoc, getDoc, type StoredDoc, type DocKind } from "@/lib/persistence";

const KEY_TO_TOOL: Record<string, ToolId> = {
  v: "select",
  h: "pan",
  t: "text",
  r: "rect",
  o: "ellipse",
  c: "circle",
  d: "diamond",
  u: "cloud",
  a: "arrow",
};

const GAP = 28; // world-px gap between pages

type Layout = {
  pages: { x: number; y: number; w: number; h: number }[];
  contentW: number;
  contentH: number;
};

function computeLayout(sizes: PageSize[]): Layout {
  const contentW = Math.max(1, ...sizes.map((s) => s.width));
  let y = 0;
  const pages = sizes.map((s) => {
    const p = { x: (contentW - s.width) / 2, y, w: s.width, h: s.height };
    y += s.height + GAP;
    return p;
  });
  return { pages, contentW, contentH: Math.max(1, y - GAP) };
}

export default function PdfViewer() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [vp, setVp] = useState({ w: 0, h: 0 });

  const stage = useStage();
  const fileInput = useRef<HTMLInputElement>(null);
  const docIdRef = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setTool, setSpacePan, undo, redo, removeSelected, loadAnnotations, annotations } =
    usePdfStore();
  const tool = usePdfStore((s) => s.tool);
  const spacePan = usePdfStore((s) => s.spacePan);
  const canPan = tool === "pan" || spacePan;

  /* ---------- open a file ---------- */
  const openFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadPdf(buf.slice(0));
        const sizes = await getPageSizes(doc);
        const lay = computeLayout(sizes);
        setPdf(doc);
        setLayout(lay);
        setFileName(file.name);

        const id = `pdfk:${file.name}:${file.size}`; // "k" = Konva model (new schema)
        docIdRef.current = id;
        const saved = await getDoc(id);
        try {
          loadAnnotations(saved?.data ? JSON.parse(saved.data) : []);
        } catch {
          loadAnnotations([]);
        }

        // register content → triggers the initial 90% fit + centre
        requestAnimationFrame(() => stage.setContent(lay.contentW, lay.contentH, true));
      } finally {
        setLoading(false);
      }
    },
    [loadAnnotations, stage]
  );

  /* ---------- track viewport size (for detail-canvas visibility) ---------- */
  useEffect(() => {
    const el = stage.viewportRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setVp({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage.viewportRef]);

  /* ---------- autosave annotations ---------- */
  useEffect(() => {
    if (!pdf || !docIdRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      const doc: StoredDoc = {
        id: docIdRef.current,
        kind: "pdf" as DocKind,
        title: fileName,
        data: JSON.stringify(annotations),
        updatedAt: new Date().toISOString(),
      };
      await saveDoc(doc);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [annotations, pdf, fileName]);

  /* ---------- keyboard: tools, zoom, fit, history ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (usePdfStore.getState().selectedIds.length) {
          e.preventDefault();
          removeSelected();
        }
        return;
      }
      if (e.key === "Escape") {
        usePdfStore.getState().clearSelection();
        return;
      }
      if (e.key === "Enter" && !mod) {
        // edit the single selected text annotation
        const st = usePdfStore.getState();
        if (st.selectedIds.length === 1) {
          const a = st.annotations.find((x) => x.id === st.selectedIds[0]);
          if (a && a.kind === "text") {
            e.preventDefault();
            st.setEditing(a.id);
          }
        }
        return;
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        stage.zoomBy(1.2);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        stage.zoomBy(1 / 1.2);
        return;
      }
      if (e.key.toLowerCase() === "f" && !mod) {
        e.preventDefault();
        stage.fit(null);
        return;
      }
      const tk = KEY_TO_TOOL[e.key.toLowerCase()];
      if (tk && !mod) setTool(tk);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, removeSelected, setTool, stage]);

  /* ---------- hold Space → temporary pan (and Space+wheel zooms) ---------- */
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setSpacePan(true);
    };
    const onUp = (e: KeyboardEvent) => e.code === "Space" && setSpacePan(false);
    const onBlur = () => setSpacePan(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      setSpacePan(false);
    };
  }, [setSpacePan]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") openFile(file);
  };

  const manualSave = async () => {
    if (!docIdRef.current) return;
    setSaveState("saving");
    await saveDoc({
      id: docIdRef.current,
      kind: "pdf",
      title: fileName,
      data: JSON.stringify(annotations),
      updatedAt: new Date().toISOString(),
    });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1200);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Home
        </Link>
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText size={18} className="text-blue-600" />
          <span className="max-w-[240px] truncate">{fileName || "PDF Viewer & Annotator"}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {pdf && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              {saveState === "saving" && <Loader2 size={13} className="animate-spin" />}
              {saveState === "saved" && <Check size={13} className="text-green-600" />}
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
            </span>
          )}
          {pdf && (
            <button
              onClick={manualSave}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Save size={15} /> Save
            </button>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <FileUp size={15} /> Open PDF
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])}
          />
        </div>
      </div>

      {pdf && (
        <PdfToolbar
          scale={stage.view.scale}
          minScale={stage.getMinScale()}
          onZoomIn={() => stage.zoomBy(1.2)}
          onZoomOut={() => stage.zoomBy(1 / 1.2)}
          onFit={() => stage.fit(null)}
        />
      )}

      {/* Stage viewport */}
      <div
        ref={stage.viewportRef}
        className="relative flex-1 overflow-hidden bg-slate-300"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{ cursor: canPan ? "grab" : "default", touchAction: "none" }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-300/70">
            <Loader2 className="animate-spin text-blue-600" size={28} />
          </div>
        )}

        {!pdf && !loading && (
          <div className="flex h-full items-center justify-center p-6">
            <label
              className={`flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-16 text-center transition ${
                dragOver ? "border-blue-500 bg-blue-50" : "border-slate-400 bg-white"
              }`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <FileUp size={28} />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">Drop a PDF here</p>
                <p className="mt-1 text-sm text-slate-500">or click to browse · large multi-page drawings supported</p>
                <p className="mt-2 text-xs text-slate-400">
                  Scroll/trackpad pans · Ctrl/Space/mouse-wheel or pinch zooms · F to fit
                </p>
              </div>
              <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} />
            </label>
          </div>
        )}

        {/* the transformed stage (all pages live in world coords inside it) */}
        {pdf && layout && (
          <div
            ref={stage.stageRef}
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: layout.contentW, height: layout.contentH, willChange: "transform" }}
          >
            {layout.pages.map((p, i) => (
              <PdfPage
                key={i}
                pdf={pdf}
                pageNumber={i + 1}
                baseWidth={p.w}
                baseHeight={p.h}
                pageX={p.x}
                pageY={p.y}
                stageView={stage.view}
                viewportW={vp.w}
                viewportH={vp.h}
              />
            ))}
          </div>
        )}

        {/* Konva vector annotation overlay — synced to the same stage transform */}
        {pdf && layout && vp.w > 0 && (
          <KonvaAnnotations stage={stage} viewportW={vp.w} viewportH={vp.h} />
        )}
      </div>
    </div>
  );
}
