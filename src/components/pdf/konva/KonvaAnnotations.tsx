"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Ellipse,
  Line,
  Path,
  Text as KText,
  Circle,
  Group,
  Shape,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import {
  usePdfStore,
  type Annotation,
  type BoxKind,
} from "../store";
import type { StageApi } from "../useStage";
import { getFittedTextBoxSize, arrowBoundingBox, arrowHeadWings, FONT_FAMILY } from "./geometry";
import { cloudPath } from "../shapes";
import TextEditorModal from "./TextEditorModal";

const DRAG_THRESHOLD = 4; // image px
const TEXT_DEFAULT_W = 180;
const TEXT_DEFAULT_H = 72;
const BOX_KINDS: BoxKind[] = ["rect", "ellipse", "circle", "diamond", "cloud"];

type Draft = { kind: string; sx: number; sy: number; ex: number; ey: number } | null;
type Marquee = { x: number; y: number; w: number; h: number } | null;

function annBBox(a: Annotation) {
  if (a.kind === "arrow") return arrowBoundingBox(a.data);
  return { x: a.data.x, y: a.data.y, width: a.data.width, height: a.data.height };
}
function intersects(a: { x: number; y: number; width: number; height: number }, b: Marquee) {
  if (!b) return false;
  return !(a.x > b.x + b.w || a.x + a.width < b.x || a.y > b.y + b.h || a.y + a.height < b.y);
}

export default function KonvaAnnotations({
  stage,
  viewportW,
  viewportH,
}: {
  stage: StageApi;
  viewportW: number;
  viewportH: number;
}) {
  const {
    tool,
    color,
    strokeSize,
    fontSize,
    annotations,
    selectedIds,
    editingId,
    spacePan,
    beginGesture,
    addAnnotation,
    updateData,
    patchAnnotation,
    removeAnnotation,
    select,
    toggleInSelection,
    clearSelection,
    setTool,
    setEditing,
  } = usePdfStore();

  const scale = stage.view.scale || 1;
  const canPan = tool === "pan" || spacePan;
  const editing = annotations.find((a) => a.id === editingId) || null;

  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const trRef = useRef<Konva.Transformer>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const draftRef = useRef<Draft>(null);
  const marqueeRef = useRef<Marquee>(null);
  const newTextRef = useRef<string | null>(null); // id of a freshly-created (empty) text
  const [draft, setDraft] = useState<Draft>(null);
  const [marquee, setMarquee] = useState<Marquee>(null);

  const world = useCallback(() => {
    const s = stage.konvaStageRef.current;
    return s?.getRelativePointerPosition() ?? { x: 0, y: 0 };
  }, [stage.konvaStageRef]);

  /* ---- attach transformer to a single non-arrow selection ---- */
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    let nodes: Konva.Node[] = [];
    if (selectedIds.length === 1) {
      const a = annotations.find((x) => x.id === selectedIds[0]);
      if (a && a.kind !== "arrow") {
        const n = nodeRefs.current.get(a.id);
        if (n) nodes = [n];
      }
    }
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, annotations]);

  const selectedKind =
    selectedIds.length === 1 ? annotations.find((a) => a.id === selectedIds[0])?.kind : undefined;

  /* ---- stage pointer handlers ---- */
  const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const s = stage.konvaStageRef.current;
    if (!s) return;
    const evt = e.evt;
    if (canPan || evt.button === 1) {
      evt.preventDefault?.();
      panRef.current = { x: evt.clientX, y: evt.clientY };
      return;
    }
    const pos = s.getRelativePointerPosition()!;
    const creating = tool !== "select" && (tool as string) !== "pan";
    if (creating) {
      draftRef.current = { kind: tool, sx: pos.x, sy: pos.y, ex: pos.x, ey: pos.y };
      setDraft(draftRef.current);
      return;
    }
    // select mode — empty area starts a marquee
    if (e.target === s) {
      if (!evt.shiftKey) clearSelection();
      marqueeRef.current = { x: pos.x, y: pos.y, w: 0, h: 0 };
      setMarquee(marqueeRef.current);
    }
  };

  const onMove = () => {
    const s = stage.konvaStageRef.current;
    if (!s) return;
    if (panRef.current) return; // panning handled by the window pointermove listener
    const pos = s.getRelativePointerPosition()!;
    if (draftRef.current) {
      draftRef.current = { ...draftRef.current, ex: pos.x, ey: pos.y };
      setDraft(draftRef.current);
    } else if (marqueeRef.current) {
      const m = marqueeRef.current;
      marqueeRef.current = { x: m.x, y: m.y, w: pos.x - m.x, h: pos.y - m.y };
      setMarquee(marqueeRef.current);
    }
  };

  // pan needs screen-space delta → track on the container via native listeners
  useEffect(() => {
    const s = stage.konvaStageRef.current;
    const container = s?.container();
    if (!container) return;
    const onPointerMove = (e: PointerEvent) => {
      if (!panRef.current) return;
      stage.panBy(e.clientX - panRef.current.x, e.clientY - panRef.current.y);
      panRef.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      panRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [stage]);

  const onUp = () => {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (draftRef.current) {
      finishDraft(draftRef.current);
      draftRef.current = null;
      setDraft(null);
      return;
    }
    if (marqueeRef.current) {
      finishMarquee(marqueeRef.current);
      marqueeRef.current = null;
      setMarquee(null);
    }
  };

  const finishDraft = (d: Draft) => {
    if (!d) return;
    const dx = Math.abs(d.ex - d.sx);
    const dy = Math.abs(d.ey - d.sy);

    if (d.kind === "arrow") {
      if (Math.hypot(d.ex - d.sx, d.ey - d.sy) < DRAG_THRESHOLD) return;
      beginGesture();
      const id = addAnnotation({
        kind: "arrow",
        color,
        size: strokeSize,
        data: {
          x1: d.sx,
          y1: d.sy,
          x2: d.ex,
          y2: d.ey,
          cx: (d.sx + d.ex) / 2,
          cy: (d.sy + d.ey) / 2,
        },
      });
      select([id]);
      setTool("select");
      return;
    }

    if (d.kind === "text") {
      let x: number, y: number, w: number, h: number;
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
        x = d.sx;
        y = d.sy;
        w = TEXT_DEFAULT_W;
        h = TEXT_DEFAULT_H;
      } else {
        x = Math.min(d.sx, d.ex);
        y = Math.min(d.sy, d.ey);
        w = dx;
        h = dy;
      }
      beginGesture();
      const id = addAnnotation({
        kind: "text",
        color,
        size: fontSize,
        data: { x, y, text: "", textMode: "textbox", width: w, height: h },
      });
      newTextRef.current = id;
      setEditing(id);
      return;
    }

    // box shapes
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
    let x = Math.min(d.sx, d.ex);
    let y = Math.min(d.sy, d.ey);
    let w = dx;
    let h = dy;
    if (d.kind === "circle") {
      const side = Math.max(w, h);
      w = side;
      h = side;
    }
    beginGesture();
    const id = addAnnotation({
      kind: d.kind as BoxKind,
      color,
      size: strokeSize,
      data: { x, y, width: w, height: h },
    });
    select([id]);
    setTool("select");
  };

  const finishMarquee = (m: Marquee) => {
    if (!m) return;
    const norm = {
      x: Math.min(m.x, m.x + m.w),
      y: Math.min(m.y, m.y + m.h),
      w: Math.abs(m.w),
      h: Math.abs(m.h),
    };
    if (norm.w < DRAG_THRESHOLD && norm.h < DRAG_THRESHOLD) return;
    const ids = annotations.filter((a) => intersects(annBBox(a), norm)).map((a) => a.id);
    select(ids);
  };

  /* ---- text editor save / cancel ---- */
  const onTextSave = (text: string) => {
    const id = editingId;
    if (!id) return;
    const a = annotations.find((x) => x.id === id);
    if (!a || a.kind !== "text") {
      setEditing(null);
      return;
    }
    if (text.trim() === "" && newTextRef.current === id) {
      // brand-new empty text → discard
      removeAnnotation(id);
    } else {
      const fit = getFittedTextBoxSize(text, a.size);
      updateData(id, { text, width: fit.width, height: fit.height });
    }
    newTextRef.current = null;
    setEditing(null);
    setTool("select");
  };
  const onTextCancel = () => {
    const id = editingId;
    if (id && newTextRef.current === id) removeAnnotation(id);
    newTextRef.current = null;
    setEditing(null);
    setTool("select");
  };

  /* ---- transform end: bake scale into geometry ---- */
  const onTransformEnd = (a: Annotation) => {
    const node = nodeRefs.current.get(a.id);
    if (!node) return;
    const sx = Math.abs(node.scaleX());
    const sy = Math.abs(node.scaleY());
    node.scaleX(1);
    node.scaleY(1);
    beginGesture();
    if (a.kind === "text") {
      const newFont = Math.max(2, Math.round(a.size * Math.max(sx, sy)));
      const fit = getFittedTextBoxSize(a.data.text, newFont);
      patchAnnotation(a.id, { size: newFont });
      updateData(a.id, { x: node.x(), y: node.y(), width: fit.width, height: fit.height });
    } else if (a.kind !== "arrow") {
      updateData(a.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(4, a.data.width * sx),
        height: Math.max(4, a.data.height * sy),
      });
    }
  };

  const onStageDblClick = () => {
    const s = stage.konvaStageRef.current;
    if (!s) return;
    const pos = s.getRelativePointerPosition();
    if (!pos) return;
    const hit = [...annotations]
      .reverse()
      .find(
        (a) =>
          a.kind === "text" &&
          pos.x >= a.data.x &&
          pos.x <= a.data.x + a.data.width &&
          pos.y >= a.data.y &&
          pos.y <= a.data.y + a.data.height
      );
    if (hit) setEditing(hit.id);
  };

  const selectNode = (e: Konva.KonvaEventObject<unknown>, id: string) => {
    if (tool !== "select") return;
    e.cancelBubble = true;
    const evt = e.evt as { shiftKey?: boolean };
    if (evt.shiftKey) toggleInSelection(id);
    else select([id]);
  };

  const draggable = tool === "select" && !editingId;

  /* ---- render a box/text annotation inside a positioned, draggable group ---- */
  const renderAnn = (a: Annotation) => {
    const isSel = selectedIds.includes(a.id);
    if (a.kind === "arrow") {
      const d = a.data;
      return (
        <Shape
          key={a.id}
          ref={(n) => {
            if (n) nodeRefs.current.set(a.id, n);
            else nodeRefs.current.delete(a.id);
          }}
          draggable={draggable}
          stroke={a.color}
          strokeWidth={a.size}
          hitStrokeWidth={Math.max(a.size, 16 / scale)}
          lineCap="round"
          lineJoin="round"
          onMouseDown={(e) => selectNode(e, a.id)}
          onTouchStart={(e) => selectNode(e, a.id)}
          onDragStart={() => beginGesture()}
          onDragEnd={(e) => {
            const nx = e.target.x();
            const ny = e.target.y();
            e.target.position({ x: 0, y: 0 });
            updateData(a.id, {
              x1: d.x1 + nx,
              y1: d.y1 + ny,
              x2: d.x2 + nx,
              y2: d.y2 + ny,
              cx: d.cx + nx,
              cy: d.cy + ny,
            });
          }}
          sceneFunc={(ctx, shape) => {
            const w = arrowHeadWings(d, a.size);
            ctx.beginPath();
            ctx.moveTo(d.x1, d.y1);
            ctx.quadraticCurveTo(d.cx, d.cy, d.x2, d.y2);
            ctx.moveTo(w.w1x, w.w1y);
            ctx.lineTo(d.x2, d.y2);
            ctx.lineTo(w.w2x, w.w2y);
            ctx.strokeShape(shape);
          }}
        />
      );
    }

    const d = a.data;
    const commonGroup = {
      x: d.x,
      y: d.y,
      draggable,
      onMouseDown: (e: Konva.KonvaEventObject<unknown>) => selectNode(e, a.id),
      onTouchStart: (e: Konva.KonvaEventObject<unknown>) => selectNode(e, a.id),
      onDblClick: () => {
        if (a.kind === "text") setEditing(a.id);
      },
      onDblTap: () => {
        if (a.kind === "text") setEditing(a.id);
      },
      onDragStart: () => beginGesture(),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
        updateData(a.id, { x: e.target.x(), y: e.target.y() }),
      onTransformEnd: () => onTransformEnd(a),
      ref: (n: Konva.Group | null) => {
        if (n) nodeRefs.current.set(a.id, n);
        else nodeRefs.current.delete(a.id);
      },
    };
    const w = d.width;
    const h = d.height;

    let inner: React.ReactNode = null;
    if (a.kind === "text") {
      inner = (
        <KText
          text={a.data.text || " "}
          fontSize={a.size}
          fontFamily={FONT_FAMILY}
          fill={a.color}
          lineHeight={1}
          wrap="none"
          ellipsis={false}
          onDblClick={() => setEditing(a.id)}
          onDblTap={() => setEditing(a.id)}
        />
      );
    } else if (a.kind === "rect") {
      inner = <Rect width={w} height={h} stroke={a.color} strokeWidth={a.size} fill="transparent" cornerRadius={2} />;
    } else if (a.kind === "ellipse" || a.kind === "circle") {
      inner = (
        <Ellipse
          x={w / 2}
          y={h / 2}
          radiusX={w / 2}
          radiusY={h / 2}
          stroke={a.color}
          strokeWidth={a.size}
          fill="transparent"
        />
      );
    } else if (a.kind === "diamond") {
      inner = (
        <Line
          points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]}
          closed
          stroke={a.color}
          strokeWidth={a.size}
          fill="transparent"
        />
      );
    } else if (a.kind === "cloud") {
      inner = <Path data={cloudPath(0, 0, w, h)} stroke={a.color} strokeWidth={a.size} fill="transparent" />;
    }

    return (
      <Group key={a.id} {...commonGroup}>
        {inner}
      </Group>
    );
  };

  /* ---- draft preview ---- */
  const draftPreview = useMemo(() => {
    if (!draft) return null;
    const { kind, sx, sy, ex, ey } = draft;
    const x = Math.min(sx, ex);
    const y = Math.min(sy, ey);
    const w = Math.abs(ex - sx);
    const h = Math.abs(ey - sy);
    const stroke = color;
    if (kind === "arrow") {
      return <Line points={[sx, sy, ex, ey]} stroke={stroke} strokeWidth={strokeSize} dash={[6 / scale, 4 / scale]} />;
    }
    if (kind === "ellipse" || kind === "circle") {
      const side = kind === "circle" ? Math.max(w, h) : 0;
      const ww = kind === "circle" ? side : w;
      const hh = kind === "circle" ? side : h;
      return <Ellipse x={x + ww / 2} y={y + hh / 2} radiusX={ww / 2} radiusY={hh / 2} stroke={stroke} strokeWidth={strokeSize} dash={[6 / scale, 4 / scale]} />;
    }
    if (kind === "diamond") {
      return <Line points={[x + w / 2, y, x + w, y + h / 2, x + w / 2, y + h, x, y + h / 2]} closed stroke={stroke} strokeWidth={strokeSize} dash={[6 / scale, 4 / scale]} />;
    }
    if (kind === "cloud") {
      return <Path data={cloudPath(x, y, w, h)} stroke={stroke} strokeWidth={strokeSize} dash={[6 / scale, 4 / scale]} />;
    }
    // rect + text preview
    return <Rect x={x} y={y} width={w} height={h} stroke={stroke} strokeWidth={strokeSize} dash={[6 / scale, 4 / scale]} />;
  }, [draft, color, strokeSize, scale]);

  /* ---- selection overlay: arrow handles + delete button ---- */
  const selOne =
    selectedIds.length === 1 ? annotations.find((a) => a.id === selectedIds[0]) : undefined;
  const selArrow = selOne && selOne.kind === "arrow" ? selOne : null;
  const hr = 6 / scale; // handle radius
  const delR = 11 / scale;

  const selectionBBox = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const boxes = annotations.filter((a) => selectedIds.includes(a.id)).map(annBBox);
    if (boxes.length === 0) return null;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedIds, annotations]);

  return (
    <>
      <div className="absolute inset-0 z-10" style={{ touchAction: "none" }}>
        <Stage
          ref={stage.konvaStageRef}
          width={viewportW}
          height={viewportH}
          scaleX={stage.view.scale}
          scaleY={stage.view.scale}
          x={stage.view.x}
          y={stage.view.y}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onDblClick={onStageDblClick}
          onDblTap={onStageDblClick}
          style={{ cursor: canPan ? "grab" : tool === "select" ? "default" : "crosshair" }}
        >
          <Layer>
            {annotations.map(renderAnn)}
            {draftPreview}

            {/* multi/box selection outline */}
            {selectionBBox && !selArrow && (
              <Rect
                x={selectionBBox.x}
                y={selectionBBox.y}
                width={selectionBBox.width}
                height={selectionBBox.height}
                stroke="#2563eb"
                strokeWidth={1 / scale}
                dash={[4 / scale, 3 / scale]}
                listening={false}
              />
            )}

            {/* transformer for single non-arrow selection */}
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              flipEnabled={false}
              keepRatio={selectedKind === "text"}
              enabledAnchors={
                selectedKind === "text"
                  ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                  : undefined
              }
              anchorSize={8}
              anchorStroke="#2563eb"
              borderStroke="#2563eb"
              boundBoxFunc={(oldB, newB) =>
                newB.width < 6 || newB.height < 6 ? oldB : newB
              }
            />

            {/* arrow custom handles */}
            {selArrow && (
              <>
                <Line
                  points={[selArrow.data.x1, selArrow.data.y1, selArrow.data.cx, selArrow.data.cy]}
                  stroke="#2563eb"
                  strokeWidth={1 / scale}
                  dash={[4 / scale, 3 / scale]}
                  listening={false}
                />
                <Line
                  points={[selArrow.data.x2, selArrow.data.y2, selArrow.data.cx, selArrow.data.cy]}
                  stroke="#2563eb"
                  strokeWidth={1 / scale}
                  dash={[4 / scale, 3 / scale]}
                  listening={false}
                />
                {(["p1", "cp", "p2"] as const).map((h) => {
                  const d = selArrow.data;
                  const px = h === "p1" ? d.x1 : h === "p2" ? d.x2 : d.cx;
                  const py = h === "p1" ? d.y1 : h === "p2" ? d.y2 : d.cy;
                  return (
                    <Circle
                      key={h}
                      x={px}
                      y={py}
                      radius={hr}
                      fill={h === "cp" ? "#bfdbfe" : "#ffffff"}
                      stroke="#2563eb"
                      strokeWidth={1.5 / scale}
                      draggable
                      onDragStart={() => beginGesture()}
                      onDragMove={(e) => {
                        const nx = e.target.x();
                        const ny = e.target.y();
                        if (h === "p1") updateData(selArrow.id, { x1: nx, y1: ny });
                        else if (h === "p2") updateData(selArrow.id, { x2: nx, y2: ny });
                        else updateData(selArrow.id, { cx: nx, cy: ny });
                      }}
                    />
                  );
                })}
              </>
            )}

            {/* delete button near top-right of the selection */}
            {selectionBBox && (
              <Group
                x={selectionBBox.x + selectionBBox.width + delR * 0.6}
                y={selectionBBox.y - delR * 0.6}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  usePdfStore.getState().removeSelected();
                }}
                onTouchStart={(e) => {
                  e.cancelBubble = true;
                  usePdfStore.getState().removeSelected();
                }}
              >
                <Circle radius={delR} fill="#ef4444" stroke="#fff" strokeWidth={1 / scale} />
                <Line points={[-delR * 0.4, -delR * 0.4, delR * 0.4, delR * 0.4]} stroke="#fff" strokeWidth={1.5 / scale} />
                <Line points={[delR * 0.4, -delR * 0.4, -delR * 0.4, delR * 0.4]} stroke="#fff" strokeWidth={1.5 / scale} />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>

      {editing && editing.kind === "text" && (
        <TextEditorModal
          initialText={editing.data.text}
          color={editing.color}
          onSave={onTextSave}
          onCancel={onTextCancel}
        />
      )}
    </>
  );
}
