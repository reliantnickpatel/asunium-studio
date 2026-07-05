"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { usePdfStore } from "./store";

export type StageView = { scale: number; x: number; y: number };
export type Insets = { left: number; right: number; top: number; bottom: number };
export type FocusOpts = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
  duration?: number;
  tight?: boolean;
};

const MAX_SCALE = 10;
const FIT_MARGIN = 0.9; // use ~90% of the available space
const OVERSCROLL = 0.8; // allow dragging until 80% of the content is off-screen
const WHEEL_ZOOM_STEP = 1.1; // per wheel tick
const SYNC_MS = 80; // debounce React state sync — short so the crisp layer snaps in fast

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Professional canvas transform controller.
 *
 * A single visual-zoom state (`stageScale`, `stagePos`) is applied to a stage
 * element via CSS transform — the imperative refs are the source of truth
 * during gestures (smooth, no React churn); React state (`view`) is synced only
 * after the interaction settles. This is UI zoom only — see measurement.ts for
 * the separate CAD scale used for real-world units.
 */
export function useStage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Optional Konva stage kept in perfect sync with the DOM stage transform so
  // the vector annotation overlay aligns with the PDF at any zoom/pan.
  const konvaStageRef = useRef<Konva.Stage | null>(null);

  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const minScaleRef = useRef(0.1);
  const contentRef = useRef({ w: 1, h: 1 });
  const insetsRef = useRef<Insets>({ left: 0, right: 0, top: 0, bottom: 0 });

  const rafRef = useRef<number | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<number | null>(null);
  const initedRef = useRef(false);

  const [view, setView] = useState<StageView>({ scale: 1, x: 0, y: 0 });

  /* ---- viewport geometry (inset-adjusted "effective" area) ---- */
  const effViewport = useCallback(() => {
    const el = viewportRef.current;
    const r = el?.getBoundingClientRect();
    const vw = r?.width ?? 0;
    const vh = r?.height ?? 0;
    const i = insetsRef.current;
    return {
      left: i.left,
      top: i.top,
      width: Math.max(1, vw - i.left - i.right),
      height: Math.max(1, vh - i.top - i.bottom),
      rectLeft: r?.left ?? 0,
      rectTop: r?.top ?? 0,
    };
  }, []);

  const computeMinScale = useCallback(() => {
    const v = effViewport();
    const { w, h } = contentRef.current;
    const s = FIT_MARGIN * Math.min(v.width / w, v.height / h);
    minScaleRef.current = Number.isFinite(s) && s > 0 ? s : 0.1;
    return minScaleRef.current;
  }, [effViewport]);

  /* ---- pan constraint: keep content mostly on-screen (80% overscroll) ---- */
  const constrain = useCallback((scale: number, x: number, y: number) => {
    const v = effViewport();
    const cw = contentRef.current.w * scale;
    const ch = contentRef.current.h * scale;
    const clampAxis = (pos: number, off: number, vp: number, size: number) => {
      const over = size * OVERSCROLL;
      let lo = off + vp - size - over;
      let hi = off + over;
      if (size <= vp) {
        lo = off - over;
        hi = off + vp - size + over;
      }
      if (lo > hi) [lo, hi] = [hi, lo];
      return clamp(pos, lo, hi);
    };
    return {
      x: clampAxis(x, v.left, v.width, cw),
      y: clampAxis(y, v.top, v.height, ch),
    };
  }, [effViewport]);

  /* ---- imperative apply (rAF-coalesced) + debounced React sync ---- */
  const applyNow = useCallback(() => {
    const x = posRef.current.x;
    const y = posRef.current.y;
    const sc = scaleRef.current;
    const s = stageRef.current;
    if (s) s.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sc})`;
    const k = konvaStageRef.current;
    if (k) {
      k.scale({ x: sc, y: sc });
      k.position({ x, y });
      k.batchDraw();
    }
  }, []);

  const queueApply = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyNow();
    });
  }, [applyNow]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setView({ scale: scaleRef.current, x: posRef.current.x, y: posRef.current.y });
    }, SYNC_MS);
  }, []);

  const commitSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setView({ scale: scaleRef.current, x: posRef.current.x, y: posRef.current.y });
  }, []);

  /** Core setter: clamp scale, constrain pan, apply, sync. */
  const setTransform = useCallback(
    (scale: number, x: number, y: number, opts?: { immediate?: boolean }) => {
      const s = clamp(scale, minScaleRef.current, MAX_SCALE);
      const p = constrain(s, x, y);
      scaleRef.current = s;
      posRef.current = p;
      queueApply();
      if (opts?.immediate) commitSync();
      else scheduleSync();
    },
    [constrain, queueApply, commitSync, scheduleSync]
  );

  /* ---- pointer-centered zoom: keep the point under (sx,sy) fixed ---- */
  const zoomAt = useCallback(
    (nextScale: number, sx: number, sy: number) => {
      const s = clamp(nextScale, minScaleRef.current, MAX_SCALE);
      const cur = scaleRef.current;
      const wx = (sx - posRef.current.x) / cur;
      const wy = (sy - posRef.current.y) / cur;
      setTransform(s, sx - wx * s, sy - wy * s);
    },
    [setTransform]
  );

  /** Pan by a screen-pixel delta (drag / pan tool / middle-drag). */
  const panBy = useCallback(
    (dx: number, dy: number) => {
      setTransform(scaleRef.current, posRef.current.x + dx, posRef.current.y + dy);
    },
    [setTransform]
  );

  /** Zoom by a factor around the effective viewport centre (or a given point). */
  const zoomBy = useCallback(
    (factor: number, center?: { x: number; y: number }) => {
      const v = effViewport();
      const cx = center?.x ?? v.left + v.width / 2;
      const cy = center?.y ?? v.top + v.height / 2;
      zoomAt(scaleRef.current * factor, cx, cy);
    },
    [effViewport, zoomAt]
  );

  /* ---- fit whole drawing, or a specific world region ---- */
  const fit = useCallback(
    (rect?: { x: number; y: number; width: number; height: number } | null) => {
      const v = effViewport();
      computeMinScale();
      const target = rect ?? { x: 0, y: 0, width: contentRef.current.w, height: contentRef.current.h };
      const raw = FIT_MARGIN * Math.min(v.width / target.width, v.height / target.height);
      const s = clamp(raw, minScaleRef.current, MAX_SCALE);
      const x = v.left + (v.width - target.width * s) / 2 - target.x * s;
      const y = v.top + (v.height - target.height * s) / 2 - target.y * s;
      setTransform(s, x, y, { immediate: true });
    },
    [effViewport, computeMinScale, setTransform]
  );

  /* ---- programmatic animated focus on a world rect ---- */
  const focusOn = useCallback(
    ({ x, y, width, height, scale, duration = 450, tight = false }: FocusOpts) => {
      const v = effViewport();
      const fillFactor = tight ? 0.92 : 0.6; // tight fills viewport; default keeps context
      const targetScale = clamp(
        scale ?? fillFactor * Math.min(v.width / width, v.height / height),
        minScaleRef.current,
        MAX_SCALE
      );
      const cx = x + width / 2;
      const cy = y + height / 2;
      const targetX = v.left + v.width / 2 - cx * targetScale;
      const targetY = v.top + v.height / 2 - cy * targetScale;
      const tp = constrain(targetScale, targetX, targetY);

      const s0 = scaleRef.current;
      const x0 = posRef.current.x;
      const y0 = posRef.current.y;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const t0 = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = easeInOutCubic(t);
        scaleRef.current = s0 + (targetScale - s0) * e;
        posRef.current = { x: x0 + (tp.x - x0) * e, y: y0 + (tp.y - y0) * e };
        applyNow();
        if (t < 1) animRef.current = requestAnimationFrame(step);
        else {
          animRef.current = null;
          commitSync();
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [effViewport, constrain, applyNow, commitSync]
  );

  /* ---- content / insets registration ---- */
  const setContent = useCallback(
    (w: number, h: number, autoFit = false) => {
      contentRef.current = { w: Math.max(1, w), h: Math.max(1, h) };
      computeMinScale();
      if (autoFit || !initedRef.current) {
        initedRef.current = true;
        fit(null);
      }
    },
    [computeMinScale, fit]
  );

  const setInsets = useCallback((partial: Partial<Insets>) => {
    insetsRef.current = { ...insetsRef.current, ...partial };
  }, []);

  /* ---- wheel: trackpad-scroll pans, ctrl/space/non-pixel wheel zooms ---- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const spaceHeld = usePdfStore.getState().spacePan;
      const wantZoom = e.ctrlKey || e.metaKey || spaceHeld || e.deltaMode !== 0;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      if (wantZoom) {
        const factor = e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
        zoomAt(scaleRef.current * factor, sx, sy);
      } else {
        // normal trackpad / wheel scroll pans the canvas
        setTransform(scaleRef.current, posRef.current.x - e.deltaX, posRef.current.y - e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, setTransform]);

  /* ---- touch: two-finger pinch-zoom + pan, rAF-smoothed ---- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = 1;
    let worldCx = 0;
    let worldCy = 0;

    const rectOf = () => el.getBoundingClientRect();
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const r = rectOf();
      startDist = dist(e.touches);
      startScale = scaleRef.current;
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      worldCx = (mx - posRef.current.x) / startScale;
      worldCy = (my - posRef.current.y) / startScale;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDist === 0) return;
      e.preventDefault();
      const r = rectOf();
      const nextScale = clamp(
        startScale * (dist(e.touches) / startDist),
        minScaleRef.current,
        MAX_SCALE
      );
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      // keep the pinched world point under the (moving) pinch centre
      scaleRef.current = nextScale;
      posRef.current = constrain(nextScale, mx - worldCx * nextScale, my - worldCy * nextScale);
      queueApply();
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && startDist !== 0) {
        startDist = 0;
        commitSync(); // sync React state only at gesture end
      }
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [constrain, queueApply, commitSync]);

  /* ---- recompute minScale on viewport resize ---- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      computeMinScale();
      if (scaleRef.current < minScaleRef.current) fit(null);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeMinScale, fit]);

  const api = useMemo(
    () => ({
      viewportRef,
      stageRef,
      konvaStageRef,
      view,
      getMinScale: () => minScaleRef.current,
      getScale: () => scaleRef.current,
      setContent,
      setInsets,
      fit,
      zoomBy,
      zoomAt,
      panBy,
      focusOn,
      applyNow,
      MAX_SCALE,
    }),
    [view, setContent, setInsets, fit, zoomBy, zoomAt, panBy, focusOn, applyNow]
  );

  return api;
}

export type StageApi = ReturnType<typeof useStage>;
