import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { saveAs } from "file-saver";
import type { Annotation, ArrowData } from "@/components/pdf/store";

type PageRect = { x: number; y: number; w: number; h: number };

type Box = { x: number; y: number; width: number; height: number };

function color(hex: string): RGB {
  const raw = hex.replace("#", "").trim();
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = parseInt(normalized, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function annotationBox(a: Annotation): Box {
  if (a.kind === "arrow") {
    const xs = [a.data.x1, a.data.x2, a.data.cx];
    const ys = [a.data.y1, a.data.y2, a.data.cy];
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x: a.data.x, y: a.data.y, width: a.data.width, height: a.data.height };
}

function findPageForAnnotation(a: Annotation, pages: PageRect[]) {
  const box = annotationBox(a);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const contained = pages.findIndex(
    (p) => cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h
  );
  if (contained >= 0) return contained;
  return pages.findIndex(
    (p) =>
      box.x < p.x + p.w &&
      box.x + box.width > p.x &&
      box.y < p.y + p.h &&
      box.y + box.height > p.y
  );
}

function pageLocal(pageRect: PageRect, pageHeight: number, x: number, y: number) {
  return { x: x - pageRect.x, y: pageHeight - (y - pageRect.y) };
}

function drawDiamond(page: PDFPage, c: RGB, size: number, x: number, y: number, w: number, h: number) {
  const points = [
    { x: x + w / 2, y: y + h },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y },
    { x, y: y + h / 2 },
  ];
  for (let i = 0; i < points.length; i++) {
    page.drawLine({
      start: points[i],
      end: points[(i + 1) % points.length],
      color: c,
      thickness: size,
    });
  }
}

function cloudPathPdf(x: number, y: number, w: number, h: number) {
  const radius = Math.max(6, Math.min(Math.abs(w), Math.abs(h)) / 6);
  const right = x + w;
  const top = y + h;

  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const count = Math.max(1, Math.round(len / (2 * radius)));
    const rr = len / (2 * count);
    let d = "";
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      d += ` A ${rr} ${rr} 0 0 1 ${x1 + (x2 - x1) * t} ${y1 + (y2 - y1) * t}`;
    }
    return d;
  };

  let d = `M ${x} ${top}`;
  d += edge(x, top, right, top);
  d += edge(right, top, right, y);
  d += edge(right, y, x, y);
  d += edge(x, y, x, top);
  return `${d} Z`;
}

function arrowHeadWings(d: ArrowData, strokeSize: number) {
  const tx = 2 * (d.x2 - d.cx);
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

function safePdfText(text: string) {
  // Standard PDF fonts are WinAnsi. Keep export robust for pasted symbols.
  return text.replace(/[^\n\r\t\x20-\x7e£©®°±×÷–—‘’“”•]/g, "?");
}

export async function exportAnnotatedPdf(
  sourceBytes: ArrayBuffer,
  annotations: Annotation[],
  pages: PageRect[]
) {
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pdfPages = pdfDoc.getPages();

  for (const annotation of annotations) {
    const pageIndex = findPageForAnnotation(annotation, pages);
    if (pageIndex < 0 || pageIndex >= pdfPages.length) continue;

    const page = pdfPages[pageIndex];
    const pageRect = pages[pageIndex];
    const pageHeight = page.getHeight();
    const c = color(annotation.color);
    const thickness = Math.max(0.5, annotation.size);

    if (annotation.kind === "arrow") {
      const d = annotation.data;
      const start = pageLocal(pageRect, pageHeight, d.x1, d.y1);
      const end = pageLocal(pageRect, pageHeight, d.x2, d.y2);
      const cp = pageLocal(pageRect, pageHeight, d.cx, d.cy);
      page.drawSvgPath(`M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${end.x} ${end.y}`, {
        borderColor: c,
        borderWidth: thickness,
      });
      const wings = arrowHeadWings(d, thickness);
      const w1 = pageLocal(pageRect, pageHeight, wings.w1x, wings.w1y);
      const w2 = pageLocal(pageRect, pageHeight, wings.w2x, wings.w2y);
      page.drawLine({ start: w1, end, color: c, thickness });
      page.drawLine({ start: w2, end, color: c, thickness });
      continue;
    }

    const d = annotation.data;
    const x = d.x - pageRect.x;
    const y = pageHeight - (d.y - pageRect.y) - d.height;
    const w = d.width;
    const h = d.height;

    if (annotation.kind === "text") {
      const lines = safePdfText(annotation.data.text || "").split(/\r?\n/);
      const lineHeight = annotation.size * 1.1;
      lines.forEach((line, i) => {
        if (!line) return;
        page.drawText(line, {
          x,
          y: y + h - annotation.size - i * lineHeight,
          size: annotation.size,
          font,
          color: c,
          maxWidth: w,
          lineHeight,
        });
      });
    } else if (annotation.kind === "rect") {
      page.drawRectangle({ x, y, width: w, height: h, borderColor: c, borderWidth: thickness });
    } else if (annotation.kind === "ellipse" || annotation.kind === "circle") {
      page.drawEllipse({
        x: x + w / 2,
        y: y + h / 2,
        xScale: w / 2,
        yScale: h / 2,
        borderColor: c,
        borderWidth: thickness,
      });
    } else if (annotation.kind === "diamond") {
      drawDiamond(page, c, thickness, x, y, w, h);
    } else if (annotation.kind === "cloud") {
      page.drawSvgPath(cloudPathPdf(x, y, w, h), { borderColor: c, borderWidth: thickness });
    }
  }

  return pdfDoc.save();
}

export function pdfBytesToBlob(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}

export function downloadPdfBlob(blob: Blob, fileName: string) {
  saveAs(blob, fileName);
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  downloadPdfBlob(pdfBytesToBlob(bytes), fileName);
}
