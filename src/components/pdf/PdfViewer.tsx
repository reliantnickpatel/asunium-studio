"use client";

/* eslint-disable react-hooks/refs -- PDF stage transforms intentionally use imperative refs for smooth zoom/pan. */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileUp, Loader2, Save, Check, FileText, Download, Home } from "lucide-react";
import { loadPdf, getPageSizes, type PDFDocumentProxy, type PageSize } from "./pdfjs";
import PdfPage from "./PdfCanvasPage";
import PdfToolbar from "./PdfToolbar";
import KonvaAnnotations from "./konva/KonvaAnnotations";
import { usePdfStore, type Annotation, type ToolId } from "./store";
import { useStage } from "./useStage";
import { saveDoc, getDoc, type StoredDoc, type DocKind } from "@/lib/persistence";
import { downloadPdfBlob, exportAnnotatedPdf, pdfBytesToBlob } from "@/lib/pdf/exportAnnotatedPdf";
import { cachePdfFile, getCachedPdf } from "@/lib/pdf/fileCache";

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
  const [openError, setOpenError] = useState("");
  const [fileName, setFileName] = useState("");
  const [pdfRenderKey, setPdfRenderKey] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [annotationsLoaded, setAnnotationsLoaded] = useState(true);
  const [downloadLink, setDownloadLink] = useState<{ url: string; fileName: string } | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [fitKey, setFitKey] = useState("");

  const stage = useStage();
  const setStageContent = stage.setContent;
  const fileInput = useRef<HTMLInputElement>(null);
  const docIdRef = useRef<string>("");
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annotationsLoadedRef = useRef(true);
  const openSeqRef = useRef(0);

  const { setTool, setSpacePan, undo, redo, removeSelected, loadAnnotations, annotations } =
    usePdfStore();
  const tool = usePdfStore((s) => s.tool);
  const spacePan = usePdfStore((s) => s.spacePan);
  const canPan = tool === "pan" || spacePan;

  const markAnnotationsLoaded = useCallback((loaded: boolean) => {
    annotationsLoadedRef.current = loaded;
    setAnnotationsLoaded(loaded);
  }, []);

  /* ---------- open a file ---------- */
  const openFile = useCallback(
    async (file: File) => {
      const openSeq = openSeqRef.current + 1;
      openSeqRef.current = openSeq;
      setLoading(true);
      setOpenError("");
      markAnnotationsLoaded(false);
      try {
        const buf = await file.arrayBuffer();
        pdfBytesRef.current = buf.slice(0);
        const doc = await loadPdf(buf.slice(0));
        const sizes = await getPageSizes(doc);
        const lay = computeLayout(sizes);
        const id = `pdfk:${file.name}:${file.size}`; // "k" = Konva model (new schema)

        void cachePdfFile({
          id,
          name: file.name,
          type: file.type || "application/pdf",
          lastModified: file.lastModified,
          bytes: buf.slice(0),
        }).catch(() => {
          /* Recent-file caching is optional; the open document remains usable. */
        });

        docIdRef.current = id;
        loadAnnotations([]);
        setPdf(doc);
        setLayout(lay);
        setFileName(file.name);
        setPdfRenderKey(`${openSeq}:${file.name}:${file.size}:${file.lastModified}`);
        setFitKey(`${openSeq}:${file.name}:${file.size}:${file.lastModified}`);
        setSaveState("idle");
        setDownloadLink((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return null;
        });

        // Saved annotations are optional and must never block the PDF canvas
        // from appearing. Fitting waits for a real viewport size below.
        setLoading(false);

        void (async () => {
          try {
            const saved = await getDoc(id);
            if (openSeqRef.current !== openSeq) return;
            if (saved?.data) loadAnnotations(JSON.parse(saved.data));
          } catch {
            /* local/server annotation history is optional */
          } finally {
            if (openSeqRef.current === openSeq) markAnnotationsLoaded(true);
          }
        })();
      } catch (error) {
        console.error("PDF open failed", error);
        if (openSeqRef.current === openSeq) {
          setPdf(null);
          setLayout(null);
          setFileName("");
          setPdfRenderKey("");
          setFitKey("");
          setOpenError(error instanceof Error ? error.message : "The PDF could not be opened.");
          loadAnnotations([]);
          markAnnotationsLoaded(true);
        }
        setLoading(false);
      }
    },
    [loadAnnotations, markAnnotationsLoaded]
  );

  useEffect(() => {
    const recentId = new URLSearchParams(window.location.search).get("doc");
    if (!recentId) return;
    let cancelled = false;
    void getCachedPdf(recentId)
      .then((cached) => {
        if (cancelled) return;
        if (!cached) {
          setOpenError("The original PDF is not available in this browser cache.");
          return;
        }
        const file = new File([cached.bytes], cached.name, {
          type: cached.type,
          lastModified: cached.lastModified,
        });
        void openFile(file);
      })
      .catch(() => {
        if (!cancelled) setOpenError("This recent PDF could not be restored from the browser cache.");
      });
    return () => {
      cancelled = true;
    };
  }, [openFile]);

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

  useEffect(() => {
    if (!layout || !fitKey || vp.w <= 0 || vp.h <= 0) return;
    setStageContent(layout.contentW, layout.contentH, true);
  }, [fitKey, layout, setStageContent, vp.w, vp.h]);

  /* ---------- autosave annotations ---------- */
  useEffect(() => {
    if (!pdf || !docIdRef.current || !annotationsLoadedRef.current) return;
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
      try {
        await saveDoc(doc);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch {
        setSaveState("error");
      }
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
        if (e.shiftKey) redo();
        else undo();
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

  useEffect(() => {
    return () => {
      if (downloadLink) URL.revokeObjectURL(downloadLink.url);
    };
  }, [downloadLink]);

  const persistPdfAnnotations = async (currentAnnotations: Annotation[]) => {
    if (!docIdRef.current) return false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    try {
      await saveDoc({
        id: docIdRef.current,
        kind: "pdf",
        title: fileName,
        data: JSON.stringify(currentAnnotations),
        updatedAt: new Date().toISOString(),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  };

  const manualSave = async () => persistPdfAnnotations(usePdfStore.getState().annotations);

  const downloadAnnotatedPdf = async () => {
    if (!pdfBytesRef.current || !layout || !annotationsLoaded) return;
    setExportingPdf(true);
    try {
      const annotationsForExport = usePdfStore.getState().annotations;
      await persistPdfAnnotations(annotationsForExport);
      const bytes = await exportAnnotatedPdf(pdfBytesRef.current, annotationsForExport, layout.pages);
      const base = (fileName || "document.pdf").replace(/\.pdf$/i, "");
      const annotatedFileName = `${base}-annotated.pdf`;
      const blob = pdfBytesToBlob(bytes);
      const url = URL.createObjectURL(blob);
      setDownloadLink((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return { url, fileName: annotatedFileName };
      });
      downloadPdfBlob(blob, annotatedFileName);
    } catch (error) {
      console.error("PDF download failed", error);
      setSaveState("error");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0d11]">
      <div className="studio-appbar flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-black px-3 text-slate-300 sm:gap-3 sm:px-4">
        <Link href="/" title="Workspace" aria-label="Workspace" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10 hover:text-white">
          <Home size={17} />
        </Link>
        <span className="h-6 w-px bg-white/10" />
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#d8594f] text-white"><FileText size={17} /></span>
          <span className="max-w-[180px] truncate text-white sm:max-w-[300px]">{fileName || "PDF Studio"}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {pdf && (
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              {saveState === "saving" && <Loader2 size={13} className="animate-spin" />}
              {saveState === "saved" && <Check size={13} className="text-green-600" />}
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                ? "Save failed"
                : ""}
            </span>
          )}
          {pdf && (
            <button
              onClick={manualSave}
                title="Save annotations"
                aria-label="Save annotations"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Save size={16} />
            </button>
          )}
          {pdf && (
            <button
              onClick={downloadAnnotatedPdf}
              disabled={exportingPdf || !annotationsLoaded}
              className="flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
          {downloadLink && (
            <a
              href={downloadLink.url}
              download={downloadLink.fileName}
              className="hidden h-9 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm text-emerald-300 hover:bg-emerald-500/15 sm:flex"
            >
              <Download size={15} />
              Ready PDF
            </a>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            className="flex h-9 items-center gap-2 rounded-md bg-[#3867d6] px-3 text-sm font-medium text-white hover:bg-[#2f58bd]"
          >
            <FileUp size={15} /> <span className="hidden sm:inline">Open PDF</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void openFile(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {/* Stage viewport */}
      <div
        ref={stage.viewportRef}
        className="studio-canvas-enter studio-pdf-grid relative flex-1 overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{ cursor: canPan ? "grab" : "default", touchAction: "none" }}
      >
        {pdf && (
          <PdfToolbar
            scale={stage.view.scale}
            minScale={stage.getMinScale()}
            onZoomIn={() => stage.zoomBy(1.2)}
            onZoomOut={() => stage.zoomBy(1 / 1.2)}
            onFit={() => stage.fit(null)}
          />
        )}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
            <Loader2 className="animate-spin text-[#4f7cff]" size={28} />
          </div>
        )}

        {!pdf && !loading && (
          <div className="flex h-full items-center justify-center p-5 sm:p-8">
            <label
              className={`studio-upload-panel flex w-full max-w-xl cursor-pointer flex-col items-center gap-4 rounded-lg border border-dashed p-10 text-center shadow-[0_8px_30px_rgba(20,27,38,0.08)] transition sm:p-14 ${
                dragOver ? "border-[#4f7cff] bg-[#111a31]" : "border-[#343943] bg-[#111318] hover:border-[#59616d]"
              }`}
            >
              <div className="studio-upload-icon flex h-12 w-12 items-center justify-center rounded-md bg-[#4f7cff] text-white">
                <FileUp size={22} />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Open a PDF to begin</p>
                <p className="mt-1 text-sm text-[#9098a4]">Drop a file here or browse your computer</p>
                {openError && (
                  <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {openError}
                  </p>
                )}
                <p className="mt-3 text-xs text-[#646d79]">Large drawings and multi-page documents supported</p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void openFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        )}

        {/* the transformed stage (all pages live in world coords inside it) */}
        {pdf && layout && (
          <div
            ref={stage.stageRef}
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: layout.contentW,
              height: layout.contentH,
              transform: `translate3d(${stage.view.x}px, ${stage.view.y}px, 0) scale(${stage.view.scale})`,
              willChange: "transform",
            }}
          >
            {layout.pages.map((p, i) => (
              <PdfPage
                key={`${pdfRenderKey}:${i}`}
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
