"use client";

import { usePdfStore, FONT_PRESETS, type ToolId } from "./store";
import {
  MousePointer2,
  Hand,
  Type,
  Square,
  Circle,
  CircleDot,
  Diamond,
  Cloud,
  Spline,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  type LucideIcon,
} from "lucide-react";

const TOOLS: { id: ToolId; icon: LucideIcon; label: string; key: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select / edit", key: "V" },
  { id: "pan", icon: Hand, label: "Pan", key: "H" },
  { id: "text", icon: Type, label: "Text box", key: "T" },
  { id: "rect", icon: Square, label: "Rectangle", key: "R" },
  { id: "ellipse", icon: Circle, label: "Ellipse", key: "O" },
  { id: "circle", icon: CircleDot, label: "Circle", key: "C" },
  { id: "diamond", icon: Diamond, label: "Diamond", key: "D" },
  { id: "cloud", icon: Cloud, label: "Revision cloud", key: "U" },
  { id: "arrow", icon: Spline, label: "Curved arrow", key: "A" },
];

const COLORS = ["#ef4444", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0f172a"];

export default function PdfToolbar({
  scale,
  minScale,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  scale: number;
  minScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  const {
    tool,
    setTool,
    color,
    setColor,
    strokeSize,
    setStrokeSize,
    fontSize,
    setFontSize,
    undo,
    redo,
    past,
    future,
    selectedIds,
    removeSelected,
    clearAll,
    applyStyleToSelection,
  } = usePdfStore();

  const hasSelection = selectedIds.length > 0;

  const pickColor = (c: string) => {
    setColor(c);
    if (hasSelection) applyStyleToSelection({ color: c });
  };
  const pickStroke = (n: number) => {
    setStrokeSize(n);
    if (hasSelection) applyStyleToSelection({ size: n });
  };
  const cycleFont = () => {
    const i = FONT_PRESETS.indexOf(fontSize);
    const next = FONT_PRESETS[(i + 1) % FONT_PRESETS.length];
    setFontSize(next);
    if (hasSelection) applyStyleToSelection({ size: next });
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
      {/* Tools */}
      <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <button
              key={t.id}
              title={`${t.label} (${t.key})`}
              onClick={() => setTool(t.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                active ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"
              }`}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <span className="mx-1 h-6 w-px bg-slate-200" />

      {/* Color */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            title="Color"
            onClick={() => pickColor(c)}
            className={`h-6 w-6 rounded-full border-2 transition ${
              color === c ? "scale-110 border-slate-800" : "border-white"
            }`}
            style={{ background: c }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => pickColor(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
          title="Custom color"
        />
      </div>

      <span className="mx-1 h-6 w-px bg-slate-200" />

      {/* Stroke width */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Stroke</span>
        <input
          type="range"
          min={1}
          max={10}
          value={strokeSize}
          onChange={(e) => pickStroke(Number(e.target.value))}
          className="w-16 accent-blue-600"
        />
        <span className="w-4 tabular-nums">{strokeSize}</span>
      </div>

      {/* Font size (cycles presets) */}
      <button
        onClick={cycleFont}
        title="Font size (click to cycle)"
        className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        <Type size={13} /> {fontSize}px
      </button>

      <span className="mx-1 h-6 w-px bg-slate-200" />

      {/* History */}
      <button
        title="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={past.length === 0}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30"
      >
        <Undo2 size={16} />
      </button>
      <button
        title="Redo (Ctrl+Y)"
        onClick={redo}
        disabled={future.length === 0}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30"
      >
        <Redo2 size={16} />
      </button>
      <button
        title="Delete selected (Del)"
        onClick={removeSelected}
        disabled={!hasSelection}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
      >
        <Trash2 size={16} />
      </button>

      {/* Zoom */}
      <div className="ml-auto flex items-center gap-1">
        <button
          title="Zoom out (−)"
          onClick={onZoomOut}
          disabled={scale <= minScale + 1e-4}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          <ZoomOut size={16} />
        </button>
        <span className="w-12 text-center text-sm tabular-nums text-slate-600">
          {Math.round(scale * 100)}%
        </span>
        <button
          title="Zoom in (+)"
          onClick={onZoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        >
          <ZoomIn size={16} />
        </button>
        <button
          title="Fit to screen (F)"
          onClick={onFit}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        >
          <Maximize size={16} />
        </button>
        <button
          title="Clear all annotations"
          onClick={() => {
            if (confirm("Remove all annotations?")) clearAll();
          }}
          className="ml-1 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
