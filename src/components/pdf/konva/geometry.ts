import type { ArrowData } from "../store";

export const FONT_FAMILY = "Inter, system-ui, sans-serif";

let _ctx: CanvasRenderingContext2D | null | undefined;
function measureCtx(): CanvasRenderingContext2D | null {
  if (_ctx !== undefined) return _ctx;
  try {
    _ctx = document.createElement("canvas").getContext("2d");
  } catch {
    _ctx = null;
  }
  return _ctx;
}

/**
 * Fit a text box to its content in image/world units.
 * width = longest measured line, height = lineCount * fontSize.
 */
export function getFittedTextBoxSize(
  text: string,
  size: number
): { width: number; height: number } {
  const fontSize = Math.max(2, size);
  const lines = (text || "").split("\n");
  const ctx = measureCtx();
  let measured = 0;
  if (ctx) {
    ctx.font = `${fontSize}px ${FONT_FAMILY}`;
    for (const line of lines) measured = Math.max(measured, ctx.measureText(line).width);
  }
  const fallback = lines.reduce((m, l) => Math.max(m, l.length * fontSize * 0.52), 0);
  const width = Math.max(4, measured || fallback);
  const height = Math.max(4, lines.length * fontSize);
  return { width, height };
}

/** Axis-aligned bounding box of an arrow (start, end, control point). */
export function arrowBoundingBox(d: ArrowData): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const xs = [d.x1, d.x2, d.cx];
  const ys = [d.y1, d.y2, d.cy];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Arrowhead wing points from the Bézier tangent at the tip (t = 1). */
export function arrowHeadWings(d: ArrowData, strokeSize: number) {
  const tx = 2 * (d.x2 - d.cx); // B'(1) = 2(P2 - CP)
  const ty = 2 * (d.y2 - d.cy);
  const angle = Math.atan2(ty, tx);
  const len = Math.max(strokeSize * 3, 8);
  const pa = Math.PI / 7;
  return {
    w1x: d.x2 - len * Math.cos(angle - pa),
    w1y: d.y2 - len * Math.sin(angle - pa),
    w2x: d.x2 - len * Math.cos(angle + pa),
    w2y: d.y2 - len * Math.sin(angle + pa),
  };
}

