"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "./pdfjs";
import type { StageView } from "./useStage";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number; // 1-based
  baseWidth: number; // world px (PDF points)
  baseHeight: number;
  pageX: number; // world position within the stage
  pageY: number;
  stageView: StageView; // settled transform
  viewportW: number;
  viewportH: number;
};

const MAX_BASE_DIM = 3000; // cap base bitmap edge (large-format drawings stay affordable)
const BASE_TARGET = 3; // aim for 3× base resolution → smooth, sharp motion layer
const MARGIN = 360; // screen-px margin so small pans stay crisp without re-render
const MAX_DETAIL_DIM = 6000; // allow a crisp detail region on large / hi-dpi viewports
const DETAIL_QUALITY = 1.3; // supersample above native → extra-sharp fine lines & text

const baseSampleFor = (w: number, h: number) =>
  Math.min(BASE_TARGET, MAX_BASE_DIM / Math.max(w, h));

/**
 * A single page rendered as two stacked canvas layers inside the transformed
 * stage (point 9):
 *   - base: full page, rendered once, always visible (crisp at fit, soft when
 *     deeply zoomed).
 *   - detail: only the visible viewport region, re-rendered at
 *     stageScale·devicePixelRatio after interaction settles, cancel-in-flight.
 * The stage's CSS transform scales both instantly during pan/zoom.
 */
export default function PdfPage({
  pdf,
  pageNumber,
  baseWidth,
  baseHeight,
  pageX,
  pageY,
  stageView,
  viewportW,
  viewportH,
}: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const detailRef = useRef<HTMLCanvasElement>(null);
  const baseDone = useRef(false);
  const detailTask = useRef<{ cancel: () => void } | null>(null);
  const [detail, setDetail] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // page screen rect from the settled transform
  const { scale, x: sx, y: sy } = stageView;
  const screenLeft = pageX * scale + sx;
  const screenTop = pageY * scale + sy;
  const screenRight = (pageX + baseWidth) * scale + sx;
  const screenBottom = (pageY + baseHeight) * scale + sy;
  const near =
    screenRight > -viewportH &&
    screenBottom > -viewportH &&
    screenLeft < viewportW + viewportH &&
    screenTop < viewportH + viewportH;

  /* ---- base canvas: render once when the page first comes near ---- */
  useEffect(() => {
    if (!near || baseDone.current) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const vp = page.getViewport({ scale: baseSampleFor(baseWidth, baseHeight) });
      const canvas = baseRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      try {
        await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) baseDone.current = true;
      } catch {
        /* cancelled */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [near, pdf, pageNumber]);

  /* ---- detail canvas: visible region at high-res, after settle ---- */
  useEffect(() => {
    detailTask.current?.cancel();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // engage the detail layer as soon as the base can't match device pixels
    const detailGate = baseSampleFor(baseWidth, baseHeight) / dpr;
    if (!near || scale <= detailGate) {
      setDetail(null);
      return;
    }
    // visible intersection in screen space (+ margin), clamped to the page
    const ix0 = Math.max(screenLeft, -MARGIN);
    const iy0 = Math.max(screenTop, -MARGIN);
    const ix1 = Math.min(screenRight, viewportW + MARGIN);
    const iy1 = Math.min(screenBottom, viewportH + MARGIN);
    if (ix1 <= ix0 || iy1 <= iy0) {
      setDetail(null);
      return;
    }
    // back to page-local world coords
    let localX = (ix0 - sx) / scale - pageX;
    let localY = (iy0 - sy) / scale - pageY;
    let localW = (ix1 - ix0) / scale;
    let localH = (iy1 - iy0) / scale;
    localX = Math.max(0, localX);
    localY = Math.max(0, localY);
    localW = Math.min(localW, baseWidth - localX);
    localH = Math.min(localH, baseHeight - localY);
    if (localW <= 0 || localH <= 0) {
      setDetail(null);
      return;
    }

    let renderScale = scale * dpr * DETAIL_QUALITY;
    const capped = Math.min(
      MAX_DETAIL_DIM / (localW * renderScale),
      MAX_DETAIL_DIM / (localH * renderScale),
      1
    );
    renderScale *= capped;

    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const vp = page.getViewport({ scale: renderScale });
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(localW * renderScale));
      off.height = Math.max(1, Math.floor(localH * renderScale));
      const octx = off.getContext("2d");
      if (!octx) return;
      const task = page.render({
        canvas: off,
        canvasContext: octx,
        viewport: vp,
        transform: [1, 0, 0, 1, -localX * renderScale, -localY * renderScale],
      });
      detailTask.current = task;
      try {
        await task.promise;
      } catch {
        return; // cancelled
      }
      if (cancelled) return;
      const canvas = detailRef.current;
      if (!canvas) return;
      canvas.width = off.width;
      canvas.height = off.height;
      canvas.getContext("2d")?.drawImage(off, 0, 0);
      setDetail({ left: localX, top: localY, width: localW, height: localH });
    })();

    return () => {
      cancelled = true;
      detailTask.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, scale, sx, sy, viewportW, viewportH, pdf, pageNumber, pageX, pageY, baseWidth, baseHeight]);

  return (
    <div
      className="absolute bg-white shadow-md"
      style={{ left: pageX, top: pageY, width: baseWidth, height: baseHeight }}
      data-page={pageNumber}
    >
      <canvas
        ref={baseRef}
        className="absolute inset-0"
        style={{ width: baseWidth, height: baseHeight }}
      />
      <canvas
        ref={detailRef}
        className="absolute"
        style={{
          left: detail?.left ?? 0,
          top: detail?.top ?? 0,
          width: detail?.width ?? 0,
          height: detail?.height ?? 0,
          display: detail ? "block" : "none",
        }}
      />
    </div>
  );
}
