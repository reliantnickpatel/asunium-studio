"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePdfStore, FONT_PRESETS, type ToolId } from "./store";
import AsuniumLogo from "@/components/AsuniumLogo";
import {
  Check,
  Circle,
  CircleDot,
  Cloud,
  Diamond,
  Eraser,
  Hand,
  Lock,
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
const COLOR_LABELS = ["Red", "Blue", "Green", "Amber", "Purple", "White"];
const panel =
  "rounded-lg border border-white/10 bg-[#07080b]/95 shadow-[0_26px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl";
const tooltip =
  "pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-[80] hidden w-max max-w-[220px] -translate-x-1/2 rounded-md border border-white/10 bg-[#07080b]/95 px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug text-white shadow-[0_18px_45px_rgba(0,0,0,0.35)] group-hover:block group-focus-visible:block";
const toolButton =
  "group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#aeb5bf] transition duration-200 hover:border-white/10 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25";
const compactButton =
  "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#aeb5bf] transition duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25";

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

  const activeToolLabel = activeShape?.label ?? MAIN_TOOLS.find((item) => item.id === tool)?.label ?? "Tool";

  return (
    <div ref={toolbarRef} className="pointer-events-none absolute inset-0 z-50">
      {picker === "shapes" && (
        <div className={`studio-bottom-popover pointer-events-auto absolute bottom-[88px] left-1/2 w-[440px] max-w-[calc(100vw-32px)] p-3 ${panel}`}>
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6f7784]">Shape system</span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#9aa3af]">Live draw</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SHAPES.map((shape, index) => {
              const Icon = shape.icon;
              const active = shape.id === tool;
              const style = { "--studio-delay": `${index * 54}ms` } as CSSProperties;
              return (
                <button
                  key={shape.id}
                  onClick={() => {
                    activateTool(shape.id);
                    setPicker(null);
                  }}
                  title={`${shape.label} (${shape.key})`}
                  className={`studio-orbit-item group relative flex h-20 flex-col items-center justify-center gap-2 rounded-lg border text-xs transition ${
                    active
                      ? "studio-tool-selected border-[#8cadff] bg-[#4f7cff] text-white"
                      : "border-white/10 bg-white/[0.045] text-[#aeb5bf] hover:border-[#4f7cff]/60 hover:bg-[#131a2a] hover:text-white"
                  }`}
                  style={style}
                >
                  <Icon size={22} className="transition group-hover:-translate-y-0.5 group-hover:scale-110" />
                  <span>{shape.label}</span>
                  <span className={tooltip}>Draw a {shape.label.toLowerCase()} ({shape.key})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {picker === "colors" && (
        <div className={`studio-bottom-popover pointer-events-auto absolute bottom-[88px] left-1/2 w-[430px] max-w-[calc(100vw-32px)] p-3 ${panel}`}>
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6f7784]">Color orbit</span>
            <span className="h-5 w-5 rounded-full border-2 border-white/50" style={{ backgroundColor: color }} />
          </div>
          <div className="grid grid-cols-6 gap-2">
            {COLORS.map((swatch, index) => {
              const style = {
                backgroundColor: swatch,
                "--studio-delay": `${index * 48}ms`,
              } as CSSProperties;
              return (
                <button
                  key={swatch}
                  aria-label={`Use color ${swatch}`}
                  title={`${COLOR_LABELS[index]} annotation color (${index + 1})`}
                  onClick={() => chooseColor(swatch)}
                  className={`studio-orbit-item group relative h-12 rounded-lg border-2 transition hover:-translate-y-1 hover:scale-105 ${
                    color.toLowerCase() === swatch ? "studio-tool-selected border-white" : "border-white/15"
                  }`}
                  style={style}
                >
                  <span className={tooltip}>{COLOR_LABELS[index]} color ({index + 1})</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-[44px_1fr_44px] gap-2 border-t border-white/10 pt-3">
            <label
              className="group relative flex h-11 cursor-pointer items-center justify-center rounded-lg border border-white/15 text-white"
              style={{ backgroundColor: customHexIsValid ? normalizedCustomHex : color }}
              title="Open system color picker"
            >
              <Pipette size={15} />
              <span className={tooltip}>Open system color picker</span>
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
              className={`h-11 min-w-0 rounded-lg border bg-[#050608] px-3 font-mono text-xs uppercase outline-none ${
                customHexIsValid ? "border-white/15 text-white focus:border-[#6f94ff]" : "border-red-500/60 text-red-300"
              }`}
              placeholder="#4F7CFF"
            />
            <button
              onClick={() => customHexIsValid && chooseColor(normalizedCustomHex.toLowerCase())}
              disabled={!customHexIsValid}
              title="Apply custom color"
              className="group relative flex h-11 items-center justify-center rounded-lg bg-[#4f7cff] text-white transition hover:bg-[#668fff] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Check size={16} />
              <span className={tooltip}>Apply custom color</span>
            </button>
          </div>
        </div>
      )}

      <div className={`studio-command-deck pointer-events-auto absolute bottom-5 left-1/2 flex max-w-[calc(100vw-32px)] items-center gap-1 overflow-x-auto p-1.5 ${panel}`}>
        <AsuniumLogo size={42} markClassName="studio-logo-pulse bg-[#202020]" />
        <span className="mx-1 hidden h-9 w-px shrink-0 bg-white/10 sm:block" />

        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.045] p-1">
          {MAIN_TOOLS.map((item) => {
            const Icon = item.icon;
            const active = tool === item.id;
            return (
              <button
                key={`${item.id}-${active ? activationTick : 0}`}
                title={`${item.label} (${item.key})`}
                aria-label={item.label}
                onClick={() => activateTool(item.id)}
                className={`${toolButton} ${active ? "studio-tool-selected border-[#8cadff] bg-[#4f7cff] text-white" : ""}`}
              >
                <Icon size={19} />
                <span className={tooltip}>
                  {item.id === "select"
                    ? "Select, move, or resize annotations"
                    : item.id === "pan"
                    ? "Move around the PDF page"
                    : "Add a text annotation"}{" "}
                  ({item.key})
                </span>
              </button>
            );
          })}
        </div>

        <button
          key={`shape-${activeShape ? activationTick : 0}-${picker === "shapes"}`}
          data-testid="shape-picker-trigger"
          title={`Shapes${activeShape ? `: ${activeShape.label}` : ""}`}
          aria-label="Choose annotation shape"
          aria-expanded={picker === "shapes"}
          onClick={() => setPicker((open) => (open === "shapes" ? null : "shapes"))}
          className={`${toolButton} ${activeShape || picker === "shapes" ? "studio-tool-selected border-[#8cadff] bg-[#4f7cff] text-white" : ""}`}
        >
          {activeShape ? <activeShape.icon size={20} /> : <Shapes size={20} />}
          <span className={tooltip}>Choose a drawing shape</span>
        </button>

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
          className={`${toolButton} ${picker === "colors" ? "studio-tool-selected border-[#8cadff] bg-[#4f7cff] text-white" : ""}`}
        >
          <Palette size={19} />
          <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border border-white/70" style={{ backgroundColor: color }} />
          <span className={tooltip}>Change annotation color</span>
        </button>

        <span className="mx-1 hidden h-9 w-px shrink-0 bg-white/10 md:block" />

        <div className="hidden shrink-0 items-center gap-2 rounded-lg bg-white/[0.045] px-2 py-1 md:flex">
          <div className={`flex items-center gap-2 ${textOnlySelection ? "text-[#58606d]" : "text-[#aeb5bf]"}`}>
            {textOnlySelection ? <Lock size={14} /> : <span className="w-6 rounded-full bg-current" style={{ height: Math.max(1, Math.min(strokeSize, 6)) }} />}
            <input
              type="range"
              min={1}
              max={10}
              value={strokeSize}
              disabled={textOnlySelection}
              onChange={(event) => chooseStroke(Number(event.target.value))}
              aria-label="Stroke width"
              title={textOnlySelection ? "Stroke is locked for text" : "Stroke width"}
              className="w-24 accent-[#4f7cff] disabled:opacity-25"
            />
            <span className="w-4 text-center text-xs tabular-nums">{strokeSize}</span>
          </div>
          <button onClick={cycleFont} title="Font size" className="group relative flex h-9 items-center gap-1 rounded-md px-2 text-xs text-[#aeb5bf] hover:bg-white/10 hover:text-white">
            <Type size={14} /> {fontSize}
            <span className={tooltip}>Cycle text size</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.045] p-1">
          <button title="Undo" aria-label="Undo" onClick={undo} disabled={past.length === 0} className={compactButton}><Undo2 size={16} /><span className={tooltip}>Undo last annotation change</span></button>
          <button title="Redo" aria-label="Redo" onClick={redo} disabled={future.length === 0} className={compactButton}><Redo2 size={16} /><span className={tooltip}>Redo annotation change</span></button>
          <button title="Delete selected" aria-label="Delete selected" onClick={removeSelected} disabled={!hasSelection} className={`${compactButton} hover:bg-red-500/15 hover:text-red-300`}><Trash2 size={16} /><span className={tooltip}>Delete selected annotation</span></button>
          <button title="Clear all annotations" aria-label="Clear all annotations" onClick={() => { if (confirm("Remove all annotations?")) clearAll(); }} className={`${compactButton} hover:bg-red-500/15 hover:text-red-300`}><Eraser size={16} /><span className={tooltip}>Remove every annotation</span></button>
        </div>

        <div className="hidden min-w-[84px] shrink-0 px-2 text-right sm:block">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737c88]">{activeToolLabel}</div>
          <div className="text-[11px] text-[#aeb5bf]">{Math.round(scale * 100)}%</div>
        </div>
      </div>

      <div className={`studio-corner-dock pointer-events-auto absolute bottom-5 right-5 hidden h-11 items-center gap-0.5 p-1 sm:flex ${panel}`}>
        <button title="Zoom out" aria-label="Zoom out" onClick={onZoomOut} disabled={scale <= minScale + 1e-4} className={compactButton}><ZoomOut size={17} /><span className={tooltip}>Zoom out</span></button>
        <span className="w-14 text-center text-xs tabular-nums text-[#c4cad2]">{Math.round(scale * 100)}%</span>
        <button title="Zoom in" aria-label="Zoom in" onClick={onZoomIn} className={compactButton}><ZoomIn size={17} /><span className={tooltip}>Zoom in</span></button>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <button title="Fit to screen" aria-label="Fit to screen" onClick={onFit} className={compactButton}><Maximize size={17} /><span className={tooltip}>Fit full PDF to screen</span></button>
      </div>
    </div>
  );
}
