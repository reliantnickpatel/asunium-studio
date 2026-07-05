"use client";

import { useEffect, useRef, useState } from "react";
import { usePdfStore, FONT_PRESETS, type ToolId } from "./store";
import {
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  Cloud,
  Diamond,
  Eraser,
  Hand,
  Maximize,
  MousePointer2,
  Palette,
  Pipette,
  Redo2,
  Shapes,
  Spline,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";

type ShapeTool = Extract<ToolId, "rect" | "ellipse" | "circle" | "diamond" | "cloud" | "arrow">;
type Picker = "shapes" | "colors" | null;

const MAIN_TOOLS: { id: ToolId; icon: LucideIcon; label: string; key: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select", key: "V" },
  { id: "pan", icon: Hand, label: "Pan", key: "H" },
  { id: "text", icon: Type, label: "Text", key: "T" },
];
const SHAPES: { id: ShapeTool; icon: LucideIcon; label: string; key: string }[] = [
  { id: "rect", icon: Square, label: "Rectangle", key: "R" },
  { id: "ellipse", icon: Circle, label: "Ellipse", key: "O" },
  { id: "circle", icon: CircleDot, label: "Circle", key: "C" },
  { id: "diamond", icon: Diamond, label: "Diamond", key: "D" },
  { id: "cloud", icon: Cloud, label: "Cloud", key: "U" },
  { id: "arrow", icon: Spline, label: "Arrow", key: "A" },
];
const COLORS = ["#ff5a5f", "#4f7cff", "#36c98f", "#ffb347", "#a879ff", "#f2f4f7"];
const iconButton =
  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#aeb5bf] transition duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25";
const dock = "rounded-lg border border-white/10 bg-[#101217] shadow-[0_16px_38px_rgba(0,0,0,0.42)]";

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
  const [picker, setPicker] = useState<Picker>(null);
  const [activationTick, setActivationTick] = useState(0);
  const [customHex, setCustomHex] = useState("#4f7cff");
  const toolbarRef = useRef<HTMLDivElement>(null);
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
    annotations,
    selectedIds,
    removeSelected,
    clearAll,
    applyStyleToSelection,
  } = usePdfStore();

  const hasSelection = selectedIds.length > 0;
  const selectedAnnotations = annotations.filter((annotation) => selectedIds.includes(annotation.id));
  const textOnlySelection =
    selectedAnnotations.length > 0 && selectedAnnotations.every((annotation) => annotation.kind === "text");
  const activeShape = SHAPES.find((shape) => shape.id === tool);
  const ActiveShapeIcon = activeShape?.icon ?? Shapes;
  const normalizedCustomHex = customHex.startsWith("#") ? customHex : `#${customHex}`;
  const customHexIsValid = /^#[0-9a-fA-F]{6}$/.test(normalizedCustomHex);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setPicker(null);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setPicker(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const activateTool = (nextTool: ToolId) => {
    setTool(nextTool);
    setActivationTick((tick) => tick + 1);
  };
  const chooseColor = (nextColor: string) => {
    setColor(nextColor);
    if (hasSelection) applyStyleToSelection({ color: nextColor });
    setPicker(null);
  };
  const chooseStroke = (size: number) => {
    if (textOnlySelection) return;
    setStrokeSize(size);
    if (hasSelection) applyStyleToSelection({ size });
  };
  const cycleFont = () => {
    const index = FONT_PRESETS.indexOf(fontSize);
    const next = FONT_PRESETS[(index + 1) % FONT_PRESETS.length];
    setFontSize(next);
    if (hasSelection) applyStyleToSelection({ size: next });
  };

  return (
    <div ref={toolbarRef} className="pointer-events-none absolute inset-0 z-50">
      <div className={`studio-toolbar-in pointer-events-auto absolute left-4 top-4 flex flex-col items-center gap-1 p-1 ${dock}`}>
        {MAIN_TOOLS.map((item) => {
          const Icon = item.icon;
          const active = tool === item.id;
          return (
            <button
              key={`${item.id}-${active ? activationTick : 0}`}
              title={`${item.label} (${item.key})`}
              aria-label={item.label}
              onClick={() => activateTool(item.id)}
              className={`${iconButton} ${active ? "studio-tool-selected bg-[#4f7cff] text-white" : ""}`}
            >
              <Icon size={18} />
            </button>
          );
        })}

        <span className="my-0.5 h-px w-7 bg-white/10" />

        <div className="relative">
          <button
            key={`shape-${activeShape ? activationTick : 0}-${picker === "shapes"}`}
            data-testid="shape-picker-trigger"
            title="Shapes"
            aria-label="Choose annotation shape"
            aria-expanded={picker === "shapes"}
            onClick={() => setPicker((open) => (open === "shapes" ? null : "shapes"))}
            className={`${iconButton} ${activeShape || picker === "shapes" ? "studio-tool-selected bg-[#4f7cff] text-white" : ""}`}
          >
            <ActiveShapeIcon size={18} />
            <ChevronRight size={10} className={`absolute right-0.5 transition-transform ${picker === "shapes" ? "rotate-180" : ""}`} />
          </button>
          {picker === "shapes" && (
            <div className={`studio-popover absolute left-12 top-0 w-64 p-2 ${dock}`}>
              <div className="px-1 pb-2 text-[10px] font-semibold uppercase text-[#747d89]">Shape tools</div>
              <div className="grid grid-cols-3 gap-1">
                {SHAPES.map((shape, index) => {
                  const Icon = shape.icon;
                  const active = shape.id === tool;
                  return (
                    <button
                      key={shape.id}
                      onClick={() => {
                        activateTool(shape.id);
                        setPicker(null);
                      }}
                      className={`studio-menu-item-in flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-xs transition ${
                        active ? "border-[#7699ff] bg-[#4f7cff] text-white" : "border-transparent bg-[#191c22] text-[#aeb5bf] hover:border-white/10 hover:bg-[#252a32] hover:text-white"
                      }`}
                      style={{ animationDelay: `${index * 38}ms` }}
                    >
                      <Icon size={19} /><span>{shape.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            key={`color-${picker === "colors"}`}
            data-testid="color-picker-trigger"
            title="Annotation color"
            aria-label="Choose annotation color"
            aria-expanded={picker === "colors"}
            onClick={() => {
              setCustomHex(color);
              setPicker((open) => (open === "colors" ? null : "colors"));
            }}
            className={`${iconButton} ${picker === "colors" ? "studio-tool-selected bg-[#4f7cff] text-white" : ""}`}
          >
            <Palette size={17} />
            <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-white/50" style={{ backgroundColor: color }} />
          </button>
          {picker === "colors" && (
            <div className={`studio-popover absolute left-12 top-0 w-64 p-3 ${dock}`}>
              <div className="pb-3 text-[10px] font-semibold uppercase text-[#747d89]">Annotation color</div>
              <div className="grid grid-cols-6 gap-2">
                {COLORS.map((swatch, index) => (
                  <button
                    key={swatch}
                    aria-label={`Use color ${swatch}`}
                    onClick={() => chooseColor(swatch)}
                    className={`studio-menu-item-in h-6 w-6 rounded-full border-2 transition hover:scale-125 ${color.toLowerCase() === swatch ? "studio-tool-selected border-white" : "border-white/20"}`}
                    style={{ backgroundColor: swatch, animationDelay: `${index * 40}ms` }}
                  />
                ))}
              </div>
              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="mb-2 text-[10px] font-semibold uppercase text-[#747d89]">Custom hex</div>
                <div className="flex items-center gap-2">
                  <label
                    className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/15 text-white"
                    style={{ backgroundColor: customHexIsValid ? normalizedCustomHex : color }}
                    title="Open system color picker"
                  >
                    <Pipette size={14} />
                    <input
                      type="color"
                      value={customHexIsValid ? normalizedCustomHex : color}
                      aria-label="Pick a custom annotation color"
                      onChange={(event) => setCustomHex(event.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <input
                    value={customHex}
                    maxLength={7}
                    aria-label="Custom color hex value"
                    onChange={(event) => setCustomHex(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && customHexIsValid) chooseColor(normalizedCustomHex.toLowerCase());
                    }}
                    className={`h-9 min-w-0 flex-1 rounded-md border bg-[#090b0f] px-2 font-mono text-xs uppercase outline-none ${customHexIsValid ? "border-white/15 text-white focus:border-[#6f94ff]" : "border-red-500/60 text-red-300"}`}
                    placeholder="#4F7CFF"
                  />
                  <button
                    onClick={() => customHexIsValid && chooseColor(normalizedCustomHex.toLowerCase())}
                    disabled={!customHexIsValid}
                    title="Apply custom color"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#4f7cff] text-white transition hover:bg-[#668fff] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Check size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`studio-toolbar-in pointer-events-auto absolute right-4 top-4 flex h-11 items-center gap-1 px-1.5 ${dock}`}>
        <div className={`flex items-center gap-2 px-2 ${textOnlySelection ? "text-[#4b515b]" : "text-[#aeb5bf]"}`}>
          <span className="flex h-4 w-5 items-center justify-center" aria-hidden="true"><span className="w-5 rounded-full bg-current" style={{ height: Math.max(1, Math.min(strokeSize, 5)) }} /></span>
          <input type="range" min={1} max={10} value={strokeSize} disabled={textOnlySelection} onChange={(event) => chooseStroke(Number(event.target.value))} aria-label="Stroke width" title={textOnlySelection ? "Stroke is locked for text" : "Stroke width"} className="w-20 accent-[#4f7cff] disabled:opacity-25" />
          <span className="w-4 text-center text-xs tabular-nums">{strokeSize}</span>
        </div>
        <span className="h-6 w-px bg-white/10" />
        <button onClick={cycleFont} title="Font size" className="flex h-8 items-center gap-1 rounded px-2 text-xs text-[#aeb5bf] hover:bg-white/10 hover:text-white"><Type size={14} /> {fontSize}</button>
        <span className="h-6 w-px bg-white/10" />
        <button title="Undo" aria-label="Undo" onClick={undo} disabled={past.length === 0} className={iconButton}><Undo2 size={16} /></button>
        <button title="Redo" aria-label="Redo" onClick={redo} disabled={future.length === 0} className={iconButton}><Redo2 size={16} /></button>
        <button title="Delete selected" aria-label="Delete selected" onClick={removeSelected} disabled={!hasSelection} className={`${iconButton} hover:bg-red-500/15 hover:text-red-300`}><Trash2 size={16} /></button>
        <button title="Clear all annotations" aria-label="Clear all annotations" onClick={() => { if (confirm("Remove all annotations?")) clearAll(); }} className={`${iconButton} hover:bg-red-500/15 hover:text-red-300`}><Eraser size={16} /></button>
      </div>

      <div className={`studio-zoom-dock pointer-events-auto absolute bottom-4 left-1/2 flex h-11 items-center gap-0.5 p-1 ${dock}`}>
        <button title="Zoom out" aria-label="Zoom out" onClick={onZoomOut} disabled={scale <= minScale + 1e-4} className={iconButton}><ZoomOut size={17} /></button>
        <span className="w-14 text-center text-xs tabular-nums text-[#c4cad2]">{Math.round(scale * 100)}%</span>
        <button title="Zoom in" aria-label="Zoom in" onClick={onZoomIn} className={iconButton}><ZoomIn size={17} /></button>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <button title="Fit to screen" aria-label="Fit to screen" onClick={onFit} className={iconButton}><Maximize size={17} /></button>
      </div>
    </div>
  );
}
