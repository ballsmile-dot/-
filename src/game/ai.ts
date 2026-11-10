import { angleTo, closestOnPath, normalizeAngle, pathTangent } from "./math";
import type { Kart, TrackData } from "./types";

export function aiControls(
  kart: Kart,
  track: TrackData,
  rivals: Kart[],
  time: number,
): {
  accel: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  useItem: boolean;
} {
  const lookAhead = 2 + Math.floor(kart.speed / 120);
  const near = closestOnPath({ x: kart.x, y: kart.y }, track.path);
  const targetIndex = (near.index + lookAhead) % track.path.length;
  const target = track.path[targetIndex];
  // Slight lane offset so AIs don't stack perfectly
  const lane = Math.sin(time * 0.7 + kart.id.charCodeAt(0)) * 18;
  const tang = pathTangent(track.path, targetIndex);
  const aim = {
    x: target.x + Math.cos(tang + Math.PI / 2) * lane,
    y: target.y + Math.sin(tang + Math.PI / 2) * lane,
  };

  const desired = angleTo(kart, aim);
  let diff = normalizeAngle(desired - kart.angle);

  const left = diff < -0.08;
  const right = diff > 0.08;
  const sharp = Math.abs(diff) > 0.55;
  const drift =
    kart.speed > 140 && sharp && near.distance < track.width * 0.4;

  // Avoid bananas / other karts roughly
  let brake = false;
  for (const other of rivals) {
    if (other.id === kart.id) continue;
    const d = Math.hypot(other.x - kart.x, other.y - kart.y);
    if (d < 40) {
      const toOther = normalizeAngle(angleTo(kart, other) - kart.angle);
      if (Math.abs(toOther) < 0.5) brake = true;
    }
  }

  const useItem =
    !!kart.item &&
    (kart.item === "boost"
      ? kart.speed < 280 || Math.random() < 0.01
      : kart.item === "shield"
        ? Math.random() < 0.004
        : Math.random() < 0.012);

  return {
    accel: !brake,
    brake,
    left,
    right,
    drift,
    useItem,
  };
}
