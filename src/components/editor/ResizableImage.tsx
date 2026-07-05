"use client";

import Image from "@tiptap/extension-image";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  WrapText,
  ImageDown,
  Trash2,
  RectangleHorizontal,
} from "lucide-react";

type Wrap = "inline" | "left" | "right" | "center";

/**
 * Word-like image node:
 *   - width / height in px (drag to resize)
 *   - `wrap`: inline | left | right | center (text-wrap layout)
 *   - 8 resize handles; corners keep aspect ratio, sides stretch
 *   - floating "Layout Options" toolbar when selected
 *
 * All attributes serialize to HTML so DOCX export + reload recover them.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (a) => (a.width ? { width: a.width } : {}),
        parseHTML: (el) => {
          const w = el.getAttribute("width");
          return w ? parseInt(w, 10) : null;
        },
      },
      height: {
        default: null,
        renderHTML: (a) => (a.height ? { height: a.height } : {}),
        parseHTML: (el) => {
          const h = el.getAttribute("height");
          return h ? parseInt(h, 10) : null;
        },
      },
      wrap: {
        default: "inline",
        renderHTML: (a) => ({ "data-wrap": a.wrap }),
        parseHTML: (el) =>
          el.getAttribute("data-wrap") || el.getAttribute("data-align") || "inline",
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

const HANDLES: { pos: string; style: React.CSSProperties; cursor: string }[] = [
  { pos: "nw", style: { top: -5, left: -5 }, cursor: "nwse-resize" },
  { pos: "n", style: { top: -5, left: "50%", marginLeft: -5 }, cursor: "ns-resize" },
  { pos: "ne", style: { top: -5, right: -5 }, cursor: "nesw-resize" },
  { pos: "e", style: { top: "50%", right: -5, marginTop: -5 }, cursor: "ew-resize" },
  { pos: "se", style: { bottom: -5, right: -5 }, cursor: "nwse-resize" },
  { pos: "s", style: { bottom: -5, left: "50%", marginLeft: -5 }, cursor: "ns-resize" },
  { pos: "sw", style: { bottom: -5, left: -5 }, cursor: "nesw-resize" },
  { pos: "w", style: { top: "50%", left: -5, marginTop: -5 }, cursor: "ew-resize" },
];

function ImageView({ node, updateAttributes, selected, editor, deleteNode }: NodeViewProps) {
  const { src, alt, width, height, wrap } = node.attrs as {
    src: string;
    alt?: string;
    width?: number | null;
    height?: number | null;
    wrap: Wrap;
  };
  const imgRef = useRef<HTMLImageElement>(null);
  const ratioRef = useRef(0);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const maxWidth = useCallback(() => {
    const dom = editor.view.dom as HTMLElement;
    const cs = getComputedStyle(dom);
    const pad = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
    return Math.max(120, dom.clientWidth - pad - 4);
  }, [editor]);

  // Set a sensible default size once the natural dimensions are known.
  const onLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    ratioRef.current = img.naturalWidth / img.naturalHeight || 1.5;
    const cap = maxWidth();
    if (!width) {
      const w = Math.min(img.naturalWidth || 400, cap);
      updateAttributes({ width: Math.round(w), height: Math.round(w / ratioRef.current) });
    } else {
      const w = Math.min(width, cap);
      const h = height ?? Math.round(w / ratioRef.current);
      if (w !== width || !height) updateAttributes({ width: Math.round(w), height: Math.round(h) });
    }
  }, [width, height, maxWidth, updateAttributes]);

  // Data-URL / cached images may already be `complete` before onLoad binds.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startResize = useCallback(
    (e: React.PointerEvent, handle: string) => {
      e.preventDefault();
      e.stopPropagation();
      const img = imgRef.current;
      if (!img) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = img.offsetWidth;
      const startH = img.offsetHeight;
      const ratio = ratioRef.current || startW / startH || 1.5;
      const cap = maxWidth();
      const isCorner = handle.length === 2;
      const signX = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
      const signY = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
      setDragHandle(handle);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let w = startW;
        let h = startH;
        if (isCorner) {
          // corners keep aspect ratio (driven by horizontal drag)
          w = Math.max(40, Math.min(cap, startW + signX * dx));
          h = Math.round(w / ratio);
        } else if (signX !== 0) {
          w = Math.max(40, Math.min(cap, startW + signX * dx)); // stretch width
        } else {
          h = Math.max(30, startH + signY * dy); // stretch height
        }
        w = Math.round(w);
        h = Math.round(h);
        setSize({ w, h });
        updateAttributes({ width: w, height: h });
      };
      const onUp = () => {
        setDragHandle(null);
        setSize(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [maxWidth, updateAttributes]
  );

  const wrapBtns: { key: Wrap; icon: React.ReactNode; label: string }[] = [
    { key: "inline", icon: <ImageDown size={15} />, label: "In line with text" },
    { key: "left", icon: <WrapText size={15} />, label: "Wrap left (text right)" },
    { key: "right", icon: <WrapText size={15} className="-scale-x-100" />, label: "Wrap right (text left)" },
    { key: "center", icon: <AlignCenter size={15} />, label: "Center (break text)" },
  ];

  return (
    <NodeViewWrapper
      as="span"
      className={`img-wrapper${selected ? " selected" : ""}`}
      data-wrap={wrap}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt || ""}
        width={width ?? undefined}
        height={height ?? undefined}
        draggable={false}
        onLoad={onLoad}
      />

      {selected && (
        <span contentEditable={false}>
          {/* Layout Options toolbar */}
          <span className="img-toolbar">
            {wrapBtns.map((b) => (
              <button
                key={b.key}
                type="button"
                title={b.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  updateAttributes({ wrap: b.key });
                }}
                className={`img-tool-btn ${wrap === b.key ? "active" : ""}`}
              >
                {b.icon}
              </button>
            ))}
            <span className="img-tool-sep" />
            <button
              type="button"
              title="Reset size"
              onMouseDown={(e) => {
                e.preventDefault();
                const cap = maxWidth();
                const w = Math.min(imgRef.current?.naturalWidth || 400, cap);
                updateAttributes({ width: Math.round(w), height: Math.round(w / (ratioRef.current || 1.5)) });
              }}
              className="img-tool-btn"
            >
              <RectangleHorizontal size={15} />
            </button>
            <button
              type="button"
              title="Delete image"
              onMouseDown={(e) => {
                e.preventDefault();
                deleteNode();
              }}
              className="img-tool-btn danger"
            >
              <Trash2 size={15} />
            </button>
          </span>

          {/* 8 resize handles */}
          {HANDLES.map((h) => (
            <span
              key={h.pos}
              className="img-handle"
              style={{ ...h.style, cursor: h.cursor }}
              onPointerDown={(e) => startResize(e, h.pos)}
            />
          ))}

          {dragHandle && size && (
            <span className="img-size-badge" contentEditable={false}>
              {size.w} × {size.h}
            </span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}
