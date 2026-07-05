"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "./pdfjs";
import type { StageView } from "./useStage";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  baseWidth: number;
  baseHeight: number;
  pageX: number;
  pageY: number;
  stageView: StageView;
  viewportW: number;
  viewportH: number;
};

const BASE_SCALE = 3.5;
const BASE_MAX_EDGE = 8192;
const BASE_MAX_PIXELS = 28_000_000;
const DETAIL_OVERSCAN = 240;
const DETAIL_QUALITY = 1.5;
const DETAIL_MAX_EDGE = 10000;
const DETAIL_MAX_PIXELS = 48_000_000;
const MAX_DPR = 3;

type RenderTask = { cancel: () => void; promise: Promise<unknown> };

const cappedScale = (
  target: number,
  width: number,
  height: number,
  maxEdge: number,
  maxPixels: number
) =>
  Math.max(
    0.5,
    Math.min(
      target,
      maxEdge / Math.max(width, height),
      Math.sqrt(maxPixels / Math.max(1, width * height))
    )
  );

const prepareCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
};

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
  const detailRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const activeDetailRef = useRef(-1);
  const [error, setError] = useState("");

  // Render away from the visible canvas, then copy once. The current page never
  // disappears while pdf.js prepares a sharper bitmap.
  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const scale = cappedScale(
          BASE_SCALE,
          baseWidth,
          baseHeight,
          BASE_MAX_EDGE,
          BASE_MAX_PIXELS
        );
        const viewport = page.getViewport({ scale });
        const buffer = document.createElement("canvas");
        const context = prepareCanvas(buffer, viewport.width, viewport.height);
        if (!context) return;

        task = page.render({ canvas: buffer, canvasContext: context, viewport, intent: "display" });
        await task.promise;
        if (cancelled) return;

        const visible = baseRef.current;
        if (!visible) return;
        visible.width = buffer.width;
        visible.height = buffer.height;
        const visibleContext = visible.getContext("2d", { alpha: false });
        if (!visibleContext) return;
        visibleContext.drawImage(buffer, 0, 0);
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Page failed to render");
        }
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, baseWidth, baseHeight]);

  // Render only the visible portion at the real on-screen pixel density. Two
  // canvases alternate so a completed detail bitmap replaces the old one in a
  // single frame instead of flashing through an empty or low-resolution state.
  useEffect(() => {
    const { scale, x: stageX, y: stageY } = stageView;
    if (scale <= 0 || viewportW <= 0 || viewportH <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const baseDensity = cappedScale(
      BASE_SCALE,
      baseWidth,
      baseHeight,
      BASE_MAX_EDGE,
      BASE_MAX_PIXELS
    );
    if (scale * dpr * DETAIL_QUALITY <= baseDensity) return;

    const screenLeft = pageX * scale + stageX;
    const screenTop = pageY * scale + stageY;
    const screenRight = (pageX + baseWidth) * scale + stageX;
    const screenBottom = (pageY + baseHeight) * scale + stageY;
    const left = Math.max(screenLeft, -DETAIL_OVERSCAN);
    const top = Math.max(screenTop, -DETAIL_OVERSCAN);
    const right = Math.min(screenRight, viewportW + DETAIL_OVERSCAN);
    const bottom = Math.min(screenBottom, viewportH + DETAIL_OVERSCAN);
    if (right <= left || bottom <= top) return;

    const localX = Math.max(0, (left - stageX) / scale - pageX);
    const localY = Math.max(0, (top - stageY) / scale - pageY);
    const localWidth = Math.min(baseWidth - localX, (right - left) / scale);
    const localHeight = Math.min(baseHeight - localY, (bottom - top) / scale);
    if (localWidth <= 0 || localHeight <= 0) return;

    const renderScale = cappedScale(
      scale * dpr * DETAIL_QUALITY,
      localWidth,
      localHeight,
      DETAIL_MAX_EDGE,
      DETAIL_MAX_PIXELS
    );
    let cancelled = false;
    let task: RenderTask | null = null;

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const nextIndex = activeDetailRef.current === 0 ? 1 : 0;
        const nextCanvas = detailRefs.current[nextIndex];
        if (!nextCanvas) return;
        const context = prepareCanvas(
          nextCanvas,
          localWidth * renderScale,
          localHeight * renderScale
        );
        if (!context) return;

        const viewport = page.getViewport({ scale: renderScale });
        task = page.render({
          canvas: nextCanvas,
          canvasContext: context,
          viewport,
          transform: [1, 0, 0, 1, -localX * renderScale, -localY * renderScale],
          intent: "display",
        });
        await task.promise;
        if (cancelled) return;

        nextCanvas.style.left = `${localX}px`;
        nextCanvas.style.top = `${localY}px`;
        nextCanvas.style.width = `${localWidth}px`;
        nextCanvas.style.height = `${localHeight}px`;
        nextCanvas.style.display = "block";

        const previousIndex = activeDetailRef.current;
        if (previousIndex >= 0) {
          const previousCanvas = detailRefs.current[previousIndex];
          if (previousCanvas) previousCanvas.style.display = "none";
        }
        activeDetailRef.current = nextIndex;
      } catch {
        // A cancelled detail render is expected during rapid zoom or pan. The
        // already-visible base/detail bitmap stays on screen.
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [
    pdf,
    pageNumber,
    baseWidth,
    baseHeight,
    pageX,
    pageY,
    stageView,
    viewportW,
    viewportH,
  ]);

  return (
    <div
      className="absolute overflow-hidden bg-white shadow-md"
      style={{ left: pageX, top: pageY, width: baseWidth, height: baseHeight }}
      data-page={pageNumber}
    >
      <canvas
        ref={baseRef}
        className="absolute inset-0"
        style={{ width: baseWidth, height: baseHeight }}
      />
      {[0, 1].map((index) => (
        <canvas
          key={index}
          ref={(canvas) => {
            detailRefs.current[index] = canvas;
          }}
          className="pointer-events-none absolute hidden"
        />
      ))}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white p-6 text-center text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
