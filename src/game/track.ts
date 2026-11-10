import type { ItemBox, TrackData, Vec2 } from "./types";

function ovalPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  wobble = 0,
): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const w = 1 + Math.sin(a * 3) * wobble;
    pts.push({
      x: cx + Math.cos(a) * rx * w,
      y: cy + Math.sin(a) * ry * w,
    });
  }
  return pts;
}

function makeItemBoxes(path: Vec2[]): ItemBox[] {
  const indices = [4, 10, 16, 22, 28, 34];
  return indices.map((i) => {
    const p = path[i % path.length];
    const n = path[(i + 1) % path.length];
    const angle = Math.atan2(n.y - p.y, n.x - p.x);
    const side = i % 2 === 0 ? 1 : -1;
    return {
      x: p.x + Math.cos(angle + Math.PI / 2) * 28 * side,
      y: p.y + Math.sin(angle + Math.PI / 2) * 28 * side,
      respawn: 0,
      pulse: Math.random() * Math.PI * 2,
    };
  });
}

export function createTrack(): TrackData {
  const path = ovalPoints(0, 0, 520, 340, 40, 0.08);
  // Squeeze one side for a more interesting chicane-ish oval
  for (let i = 0; i < path.length; i++) {
    const a = (i / path.length) * Math.PI * 2;
    if (a > 0.8 && a < 1.6) {
      path[i].x *= 0.86;
      path[i].y += 40;
    }
    if (a > 3.4 && a < 4.4) {
      path[i].x *= 0.9;
      path[i].y -= 30;
    }
  }

  const checkpoints = path
    .filter((_, i) => i % 5 === 0)
    .map((p) => ({ x: p.x, y: p.y, radius: 90 }));

  const start = { ...path[0] };
  const next = path[1];
  const startAngle = Math.atan2(next.y - start.y, next.x - start.x);

  return {
    path,
    width: 110,
    checkpoints,
    itemBoxes: makeItemBoxes(path),
    start,
    startAngle,
    laps: 3,
  };
}

/** Build left/right curb polylines for rendering. */
export function curbPolylines(
  path: Vec2[],
  halfWidth: number,
): { left: Vec2[]; right: Vec2[] } {
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[(i - 1 + path.length) % path.length];
    const next = path[(i + 1) % path.length];
    const ang = Math.atan2(next.y - prev.y, next.x - prev.x);
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    left.push({ x: path[i].x + nx * halfWidth, y: path[i].y + ny * halfWidth });
    right.push({
      x: path[i].x - nx * halfWidth,
      y: path[i].y - ny * halfWidth,
    });
  }
  return { left, right };
}
