/**
 * Visual zoom vs. measurement scale — kept strictly separate.
 *
 *  - `stageScale` (in useStage) is ONLY UI zoom: how big the drawing appears
 *    on screen. It changes constantly as the user zooms/pans and must never be
 *    used for real-world calculations.
 *
 *  - `MeasurementScale` (below) is the drawing's CAD scale (e.g. 1:50, 1:100).
 *    It is the ONLY thing used to convert on-page pixels/points into real-world
 *    units. It does not change when the user zooms.
 *
 * World units here = PDF points (1 pt = 1/72 inch), i.e. the page's base pixels
 * at stageScale = 1.
 */

export type MeasurementScale = {
  /** ratio denominator, e.g. 50 for 1:50 */
  ratio: number;
  /** real-world unit label */
  unit: "mm" | "cm" | "m" | "in" | "ft";
};

/** mm of real world represented by one PDF point at the given drawing scale. */
function realMmPerPoint(scale: MeasurementScale): number {
  const MM_PER_POINT = 25.4 / 72; // paper mm per point
  return MM_PER_POINT * scale.ratio; // real mm per point
}

const MM_PER_UNIT: Record<MeasurementScale["unit"], number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

/**
 * Convert a distance measured in WORLD units (PDF points, i.e. base pixels)
 * into real-world units. NOTE: takes world points, never `stageScale`-scaled
 * screen pixels — visual zoom is irrelevant to the real measurement.
 */
export function worldToReal(worldPoints: number, scale: MeasurementScale): number {
  const mm = worldPoints * realMmPerPoint(scale);
  return mm / MM_PER_UNIT[scale.unit];
}

export function formatReal(worldPoints: number, scale: MeasurementScale): string {
  const v = worldToReal(worldPoints, scale);
  return `${v.toFixed(2)} ${scale.unit}`;
}
