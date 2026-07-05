"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";

export type ToolId =
  | "select"
  | "pan"
  | "rect"
  | "ellipse"
  | "circle"
  | "diamond"
  | "cloud"
  | "arrow"
  | "text";

export type BoxKind = "rect" | "ellipse" | "circle" | "diamond" | "cloud";

export type BoxData = { x: number; y: number; width: number; height: number };
export type ArrowData = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
};
export type TextData = {
  x: number;
  y: number;
  text: string;
  textMode: "textbox";
  width: number;
  height: number;
};

/** All geometry is stored in image/world coordinates — never multiplied by zoom. */
export type Annotation =
  | { id: string; kind: BoxKind; color: string; size: number; data: BoxData }
  | { id: string; kind: "arrow"; color: string; size: number; data: ArrowData }
  | { id: string; kind: "text"; color: string; size: number; data: TextData };

export const FONT_PRESETS = [12, 24, 48];

type PdfState = {
  tool: ToolId;
  color: string;
  strokeSize: number; // default stroke width for shapes/arrows
  fontSize: number; // default font size for the text tool
  annotations: Annotation[];
  selectedIds: string[];
  editingId: string | null; // text annotation currently open in the editor
  spacePan: boolean;
  past: Annotation[][];
  future: Annotation[][];

  setTool: (t: ToolId) => void;
  setColor: (c: string) => void;
  setStrokeSize: (n: number) => void;
  setFontSize: (n: number) => void;
  setSpacePan: (v: boolean) => void;

  select: (ids: string[]) => void;
  selectAll: () => void;
  toggleInSelection: (id: string) => void;
  clearSelection: () => void;

  beginGesture: () => void;
  addAnnotation: (a: Omit<Annotation, "id">) => string;
  updateData: (id: string, patch: Record<string, number | string>) => void;
  patchAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  clearAll: () => void;

  setEditing: (id: string | null) => void;
  /** apply current color/size to the selected annotations */
  applyStyleToSelection: (patch: { color?: string; size?: number }) => void;

  undo: () => void;
  redo: () => void;
  loadAnnotations: (a: Annotation[]) => void;
};

const clone = (a: Annotation[]): Annotation[] =>
  a.map((x) => ({ ...x, data: { ...x.data } }) as Annotation);

export const usePdfStore = create<PdfState>((set, get) => ({
  tool: "select",
  color: "#ef4444",
  strokeSize: 2,
  fontSize: 12,
  annotations: [],
  selectedIds: [],
  editingId: null,
  spacePan: false,
  past: [],
  future: [],

  setTool: (t) => set({ tool: t, selectedIds: t === "select" ? get().selectedIds : [] }),
  setColor: (color) => set({ color }),
  setStrokeSize: (strokeSize) => set({ strokeSize }),
  setFontSize: (fontSize) => set({ fontSize }),
  setSpacePan: (spacePan) => set({ spacePan }),

  select: (ids) => set({ selectedIds: ids }),
  selectAll: () => set((s) => ({ selectedIds: s.annotations.map((annotation) => annotation.id) })),
  toggleInSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),

  beginGesture: () =>
    set((s) => ({ past: [...s.past, clone(s.annotations)].slice(-120), future: [] })),

  addAnnotation: (a) => {
    const id = nanoid(9);
    set((s) => ({ annotations: [...s.annotations, { ...a, id } as Annotation], selectedIds: [id] }));
    return id;
  },

  updateData: (id, patch) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? ({ ...a, data: { ...a.data, ...patch } } as Annotation) : a
      ),
    })),

  patchAnnotation: (id, patch) =>
    set((s) => ({
      annotations: s.annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
    })),

  removeAnnotation: (id) => {
    get().beginGesture();
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedIds: s.selectedIds.filter((x) => x !== id),
    }));
  },

  removeSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().beginGesture();
    set((s) => ({
      annotations: s.annotations.filter((a) => !selectedIds.includes(a.id)),
      selectedIds: [],
    }));
  },

  duplicateSelected: () => {
    const { annotations, selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().beginGesture();
    const copies = annotations
      .filter((annotation) => selectedIds.includes(annotation.id))
      .map((annotation) => ({
        ...annotation,
        id: nanoid(9),
        data:
          annotation.kind === "arrow"
            ? {
                ...annotation.data,
                x1: annotation.data.x1 + 18,
                y1: annotation.data.y1 + 18,
                x2: annotation.data.x2 + 18,
                y2: annotation.data.y2 + 18,
                cx: annotation.data.cx + 18,
                cy: annotation.data.cy + 18,
              }
            : {
                ...annotation.data,
                x: annotation.data.x + 18,
                y: annotation.data.y + 18,
              },
      })) as Annotation[];
    set((s) => ({ annotations: [...s.annotations, ...copies], selectedIds: copies.map((copy) => copy.id) }));
  },

  nudgeSelected: (dx, dy) => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().beginGesture();
    set((s) => ({
      annotations: s.annotations.map((annotation) => {
        if (!selectedIds.includes(annotation.id)) return annotation;
        if (annotation.kind === "arrow") {
          return {
            ...annotation,
            data: {
              ...annotation.data,
              x1: annotation.data.x1 + dx,
              y1: annotation.data.y1 + dy,
              x2: annotation.data.x2 + dx,
              y2: annotation.data.y2 + dy,
              cx: annotation.data.cx + dx,
              cy: annotation.data.cy + dy,
            },
          };
        }
        if (annotation.kind === "text") {
          return {
            ...annotation,
            data: {
              ...annotation.data,
              x: annotation.data.x + dx,
              y: annotation.data.y + dy,
            },
          };
        }
        return {
          ...annotation,
          data: {
            ...annotation.data,
            x: annotation.data.x + dx,
            y: annotation.data.y + dy,
          },
        };
      }),
    }));
  },

  clearAll: () => {
    get().beginGesture();
    set({ annotations: [], selectedIds: [] });
  },

  setEditing: (editingId) => set({ editingId }),

  applyStyleToSelection: ({ color, size }) => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().beginGesture();
    set((s) => ({
      annotations: s.annotations.map((a) =>
        selectedIds.includes(a.id)
          ? ({ ...a, ...(color ? { color } : {}), ...(size ? { size } : {}) } as Annotation)
          : a
      ),
    }));
  },

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        future: [clone(s.annotations), ...s.future].slice(0, 120),
        annotations: prev,
        selectedIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        past: [...s.past, clone(s.annotations)],
        future: s.future.slice(1),
        annotations: next,
        selectedIds: [],
      };
    }),

  loadAnnotations: (a) => set({ annotations: a, past: [], future: [], selectedIds: [] }),
}));

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // Read-only debug handle for console inspection / e2e tests (dev only).
  (window as unknown as { __pdfStore?: typeof usePdfStore }).__pdfStore = usePdfStore;
}
