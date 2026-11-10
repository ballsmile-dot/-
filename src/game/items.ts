import { dist } from "./math";
import type { Banana, ItemKind, Kart, Missile, TrackData } from "./types";

const ITEM_POOL: ItemKind[] = ["boost", "banana", "shield", "missile"];

export function pickItem(rank: number, total: number): ItemKind {
  // Behind players get better items (KartRider-ish)
  const behind = rank / Math.max(1, total - 1);
  if (behind > 0.66) {
    return Math.random() < 0.55 ? "missile" : "boost";
  }
  if (behind > 0.33) {
    return ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
  }
  return Math.random() < 0.5 ? "banana" : "shield";
}

export function collectItemBoxes(
  karts: Kart[],
  track: TrackData,
  ranks: Map<string, number>,
  dt: number,
): void {
  for (const box of track.itemBoxes) {
    box.pulse += dt * 4;
    if (box.respawn > 0) {
      box.respawn -= dt;
      continue;
    }
    for (const kart of karts) {
      if (kart.finished || kart.item) continue;
      if (dist(kart, box) < 28) {
        kart.item = pickItem(ranks.get(kart.id) ?? 0, karts.length);
        box.respawn = 4.5;
        break;
      }
    }
  }
}

export function useItem(
  kart: Kart,
  karts: Kart[],
  bananas: Banana[],
  missiles: Missile[],
): void {
  if (!kart.item || kart.stunned > 0 || kart.finished) return;
  const kind = kart.item;
  kart.item = null;

  if (kind === "boost") {
    kart.boostTimer = Math.max(kart.boostTimer, 1.1);
    kart.speed = Math.max(kart.speed, 400);
    return;
  }

  if (kind === "shield") {
    kart.shieldTimer = Math.max(kart.shieldTimer, 3.2);
    return;
  }

  if (kind === "banana") {
    bananas.push({
      x: kart.x - Math.cos(kart.angle) * 36,
      y: kart.y - Math.sin(kart.angle) * 36,
      life: 12,
    });
    return;
  }

  if (kind === "missile") {
    // Target the kart ahead
    const sorted = [...karts]
      .filter((k) => !k.finished || k.id === kart.id)
      .sort((a, b) => b.progress - a.progress);
    const myRank = sorted.findIndex((k) => k.id === kart.id);
    const target = sorted[Math.max(0, myRank - 1)];
    const angle =
      target && target.id !== kart.id
        ? Math.atan2(target.y - kart.y, target.x - kart.x)
        : kart.angle;
    missiles.push({
      x: kart.x + Math.cos(angle) * 30,
      y: kart.y + Math.sin(angle) * 30,
      angle,
      life: 2.4,
      ownerId: kart.id,
    });
  }
}

export function updateHazards(
  karts: Kart[],
  bananas: Banana[],
  missiles: Missile[],
  dt: number,
): void {
  for (let i = bananas.length - 1; i >= 0; i--) {
    const b = bananas[i];
    b.life -= dt;
    if (b.life <= 0) {
      bananas.splice(i, 1);
      continue;
    }
    for (const kart of karts) {
      if (kart.stunned > 0 || kart.finished) continue;
      if (dist(kart, b) < 22) {
        if (kart.shieldTimer > 0) {
          kart.shieldTimer = 0;
        } else {
          kart.stunned = 1.1;
          kart.speed *= 0.2;
          kart.driftGauge = 0;
        }
        bananas.splice(i, 1);
        break;
      }
    }
  }

  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.life -= dt;
    m.x += Math.cos(m.angle) * 520 * dt;
    m.y += Math.sin(m.angle) * 520 * dt;
    if (m.life <= 0) {
      missiles.splice(i, 1);
      continue;
    }

    // Mild homing toward nearest opponent ahead of owner
    let nearest: Kart | null = null;
    let nearestD = 180;
    for (const kart of karts) {
      if (kart.id === m.ownerId || kart.finished) continue;
      const d = dist(m, kart);
      if (d < nearestD) {
        nearestD = d;
        nearest = kart;
      }
    }
    if (nearest) {
      const desired = Math.atan2(nearest.y - m.y, nearest.x - m.x);
      let diff = desired - m.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.angle += clamp(diff, -2.5 * dt, 2.5 * dt);
    }

    for (const kart of karts) {
      if (kart.id === m.ownerId || kart.finished) continue;
      if (dist(m, kart) < 26) {
        if (kart.shieldTimer > 0) {
          kart.shieldTimer = 0;
        } else {
          kart.stunned = 1.4;
          kart.speed = 0;
          kart.driftGauge = 0;
        }
        missiles.splice(i, 1);
        break;
      }
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const ITEM_LABEL: Record<ItemKind, string> = {
  boost: "🚀",
  banana: "🍌",
  shield: "🛡️",
  missile: "🎯",
};

export const ITEM_NAME: Record<ItemKind, string> = {
  boost: "부스터",
  banana: "바나나",
  shield: "실드",
  missile: "미사일",
};
