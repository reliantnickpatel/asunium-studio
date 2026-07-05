/**
 * Geometry helpers for annotation shapes, all in display-pixel space.
 */

/** Scalloped "cloud" outline around a rectangle. */
export function cloudPath(x: number, y: number, w: number, h: number): string {
  const W = Math.abs(w);
  const H = Math.abs(h);
  const left = Math.min(x, x + w);
  const top = Math.min(y, y + h);
  const right = left + W;
  const bottom = top + H;

  const r = Math.max(6, Math.min(W, H) / 6);

  const edge = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): string => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(len / (2 * r)));
    const rr = len / (2 * n);
    let d = "";
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      // clockwise traversal + sweep=1 => arcs bulge outward
      d += ` A ${rr} ${rr} 0 0 1 ${px} ${py}`;
    }
    return d;
  };

  let d = `M ${left} ${top}`;
  d += edge(left, top, right, top); // top L->R
  d += edge(right, top, right, bottom); // right T->B
  d += edge(right, bottom, left, bottom); // bottom R->L
  d += edge(left, bottom, left, top); // left B->T
  d += " Z";
  return d;
}

/** Arrow head triangle points for a line ending at (x2,y2) coming from (x1,y1). */
export function arrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI - Math.PI / 7;
  const a2 = angle + Math.PI + Math.PI / 7;
  const p1x = x2 + size * Math.cos(a1);
  const p1y = y2 + size * Math.sin(a1);
  const p2x = x2 + size * Math.cos(a2);
  const p2y = y2 + size * Math.sin(a2);
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`;
}
