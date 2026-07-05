"use client";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  ExternalHyperlink,
  LevelFormat,
  PageBreak,
  convertInchesToTwip,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  TextWrappingSide,
} from "docx";
import { saveAs } from "file-saver";

/* ---------- image loading ---------- */

type LoadedImage = {
  data: Uint8Array;
  type: "png" | "jpg" | "gif" | "bmp";
  width: number;
  height: number;
};

function mimeToType(mime: string): LoadedImage["type"] {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("bmp")) return "bmp";
  return "png";
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const MAX_CONTENT_WIDTH = 600; // px, ~ letter page minus margins

async function loadImage(
  src: string,
  declaredWidth?: number | null,
  declaredHeight?: number | null
): Promise<LoadedImage | null> {
  try {
    let data: Uint8Array;
    let type: LoadedImage["type"];

    if (src.startsWith("data:")) {
      const [head, b64] = src.split(",");
      const mime = head.slice(5, head.indexOf(";"));
      type = mimeToType(mime);
      data = base64ToBytes(b64);
    } else {
      const res = await fetch(src);
      const blob = await res.blob();
      type = mimeToType(blob.type);
      data = new Uint8Array(await blob.arrayBuffer());
    }

    // natural dimensions for aspect ratio
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: declaredWidth || 300, h: 200 });
      img.src = src;
    });

    const ratio = dims.h && dims.w ? dims.h / dims.w : 0.66;
    let width = declaredWidth || dims.w || 300;
    let height = declaredHeight || Math.round(width * ratio);
    // scale down proportionally if wider than the page content area
    if (width > MAX_CONTENT_WIDTH) {
      const s = MAX_CONTENT_WIDTH / width;
      width = MAX_CONTENT_WIDTH;
      height = Math.round(height * s);
    }

    return { data, type, width: Math.round(width), height: Math.round(height) };
  } catch {
    return null;
  }
}

/* ---------- inline run builders ---------- */

type InlineStyle = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
};

function rgbToHex(input: string): string | undefined {
  if (!input) return undefined;
  if (input.startsWith("#")) return input.replace("#", "").slice(0, 6);
  const m = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return undefined;
  return [m[1], m[2], m[3]]
    .map((n) => parseInt(n, 10).toString(16).padStart(2, "0"))
    .join("");
}

async function buildInline(
  node: Node,
  style: InlineStyle
): Promise<(TextRun | ExternalHyperlink | ImageRun)[]> {
  const out: (TextRun | ExternalHyperlink | ImageRun)[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.length === 0) continue;
      out.push(
        new TextRun({
          text,
          bold: style.bold,
          italics: style.italics,
          underline: style.underline ? {} : undefined,
          strike: style.strike,
          color: style.color,
          highlight: style.highlight as never,
        })
      );
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const next: InlineStyle = { ...style };

    if (tag === "strong" || tag === "b") next.bold = true;
    if (tag === "em" || tag === "i") next.italics = true;
    if (tag === "u") next.underline = true;
    if (tag === "s" || tag === "strike" || tag === "del") next.strike = true;
    if (tag === "mark") {
      next.highlight = "yellow";
    }
    if (el.style?.color) next.color = rgbToHex(el.style.color);

    if (tag === "br") {
      out.push(new TextRun({ text: "", break: 1 }));
      continue;
    }

    if (tag === "img") {
      const w = el.getAttribute("width");
      const h = el.getAttribute("height");
      const wrap = el.getAttribute("data-wrap") || "inline";
      const loaded = await loadImage(
        el.getAttribute("src") || "",
        w ? parseInt(w, 10) : null,
        h ? parseInt(h, 10) : null
      );
      if (loaded) {
        const base = {
          type: loaded.type,
          data: loaded.data,
          transformation: { width: loaded.width, height: loaded.height },
        };
        if (wrap === "left" || wrap === "right") {
          // Real Word text-wrap: image floats to the side, text flows past it.
          out.push(
            new ImageRun({
              ...base,
              floating: {
                horizontalPosition: {
                  relative: HorizontalPositionRelativeFrom.MARGIN,
                  align:
                    wrap === "left"
                      ? HorizontalPositionAlign.LEFT
                      : HorizontalPositionAlign.RIGHT,
                },
                verticalPosition: {
                  relative: VerticalPositionRelativeFrom.LINE,
                  offset: 0,
                },
                wrap: {
                  type: TextWrappingType.SQUARE,
                  side:
                    wrap === "left" ? TextWrappingSide.RIGHT : TextWrappingSide.LEFT,
                },
                margins: { left: 90000, right: 90000, top: 45000, bottom: 45000 },
              },
            })
          );
        } else {
          out.push(new ImageRun(base));
        }
      }
      continue;
    }

    if (tag === "a") {
      const runs = await buildInline(el, { ...next, color: "2563eb", underline: true });
      out.push(
        new ExternalHyperlink({
          link: el.getAttribute("href") || "#",
          children: runs as TextRun[],
        })
      );
      continue;
    }

    out.push(...(await buildInline(el, next)));
  }

  return out;
}

/* ---------- block builders ---------- */

function alignmentOf(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const a = el.style?.textAlign;
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  if (a === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

const cellBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "94a3b8",
};

async function buildCell(el: HTMLElement): Promise<TableCell> {
  const children: (Paragraph | Table)[] = [];
  // A cell may contain block elements or inline content.
  const blockChildren = Array.from(el.children).filter((c) =>
    ["p", "ul", "ol", "table", "h1", "h2", "h3"].includes(c.tagName.toLowerCase())
  );
  if (blockChildren.length > 0) {
    for (const c of blockChildren) {
      children.push(...(await buildBlock(c as HTMLElement)));
    }
  } else {
    children.push(
      new Paragraph({
        alignment: alignmentOf(el),
        children: await buildInline(el, {}),
      })
    );
  }
  if (children.length === 0) children.push(new Paragraph({ children: [] }));

  const colSpan = parseInt(el.getAttribute("colspan") || "1", 10);
  const rowSpan = parseInt(el.getAttribute("rowspan") || "1", 10);
  const isHeader = el.tagName.toLowerCase() === "th";

  return new TableCell({
    children: children as Paragraph[],
    columnSpan: colSpan > 1 ? colSpan : undefined,
    rowSpan: rowSpan > 1 ? rowSpan : undefined,
    shading: isHeader ? { fill: "f1f5f9" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

async function buildTable(tableEl: HTMLElement): Promise<Table> {
  const rows: TableRow[] = [];
  const trs = tableEl.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tr");
  for (const tr of Array.from(trs)) {
    const cells: TableCell[] = [];
    for (const cell of Array.from(tr.children)) {
      cells.push(await buildCell(cell as HTMLElement));
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: cellBorder,
      bottom: cellBorder,
      left: cellBorder,
      right: cellBorder,
      insideHorizontal: cellBorder,
      insideVertical: cellBorder,
    },
  });
}

const HEADING_MAP: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
};

async function buildBlock(el: HTMLElement): Promise<(Paragraph | Table)[]> {
  const tag = el.tagName.toLowerCase();

  if (el.hasAttribute("data-page-break")) {
    return [new Paragraph({ children: [new PageBreak()] })];
  }

  if (tag in HEADING_MAP) {
    return [
      new Paragraph({
        heading: HEADING_MAP[tag],
        alignment: alignmentOf(el),
        children: await buildInline(el, {}),
      }),
    ];
  }

  if (tag === "p" || tag === "div") {
    return [
      new Paragraph({
        alignment: alignmentOf(el),
        children: await buildInline(el, {}),
      }),
    ];
  }

  if (tag === "hr") {
    return [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "cbd5e1" } },
        children: [],
      }),
    ];
  }

  if (tag === "blockquote") {
    const paras: Paragraph[] = [];
    for (const c of Array.from(el.children).length
      ? Array.from(el.children)
      : [el]) {
      paras.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.4) },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "cbd5e1", space: 8 } },
          children: await buildInline(c as HTMLElement, { italics: true }),
        })
      );
    }
    return paras;
  }

  if (tag === "ul" || tag === "ol") {
    const paras: Paragraph[] = [];
    const ordered = tag === "ol";
    for (const li of Array.from(el.children)) {
      paras.push(
        new Paragraph({
          numbering: ordered
            ? { reference: "ordered", level: 0 }
            : undefined,
          bullet: ordered ? undefined : { level: 0 },
          children: await buildInline(li as HTMLElement, {}),
        })
      );
    }
    return paras;
  }

  if (tag === "table") {
    return [await buildTable(el)];
  }

  // Fallback: treat as paragraph
  return [
    new Paragraph({ children: await buildInline(el, {}) }),
  ];
}

/* ---------- entry point ---------- */

export async function exportHtmlToDocx(html: string, filename = "document.docx") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  const blocks: (Paragraph | Table)[] = [];
  for (const el of Array.from(body.children)) {
    blocks.push(...(await buildBlock(el as HTMLElement)));
  }
  if (blocks.length === 0) blocks.push(new Paragraph({ children: [] }));

  const document = new Document({
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: blocks,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, filename.endsWith(".docx") ? filename : `${filename}.docx`);
}
