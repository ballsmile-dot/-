import type { Vec2 } from "./types";

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Closest point on a polyline path. */
export function closestOnPath(
  p: Vec2,
  path: Vec2[],
): { point: Vec2; index: number; t: number; distance: number } {
  let bestDist = Infinity;
  let bestPoint = path[0];
  let bestIndex = 0;
  let bestT = 0;

  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = clamp(t, 0, 1);
    const qx = a.x + abx * t;
    const qy = a.y + aby * t;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = { x: qx, y: qy };
      bestIndex = i;
      bestT = t;
    }
  }

  return { point: bestPoint, index: bestIndex, t: bestT, distance: bestDist };
}

export function pathTangent(path: Vec2[], index: number): number {
  const a = path[index];
  const b = path[(index + 1) % path.length];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

