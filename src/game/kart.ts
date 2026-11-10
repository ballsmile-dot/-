import { clamp, closestOnPath, normalizeAngle } from "./math";
import type { Kart, KartColor, TrackData } from "./types";

const MAX_SPEED = 320;
const BOOST_SPEED = 460;
const ACCEL = 420;
const BRAKE = 520;
const DRAG = 1.6;
const STEER = 2.8;
const DRIFT_STEER = 3.6;
const OFFTRACK_DRAG = 4.2;

export const PALETTE: KartColor[] = [
  { body: "#38bdf8", accent: "#0369a1", canopy: "#e0f2fe" },
  { body: "#fb7185", accent: "#be123c", canopy: "#ffe4e6" },
  { body: "#4ade80", accent: "#15803d", canopy: "#dcfce7" },
  { body: "#fbbf24", accent: "#b45309", canopy: "#fef3c7" },
  { body: "#c084fc", accent: "#7e22ce", canopy: "#f3e8ff" },
];

export function createKart(
  id: string,
  name: string,
  x: number,
  y: number,
  angle: number,
  color: KartColor,
  isPlayer: boolean,
): Kart {
  return {
    id,
    name,
    x,
    y,
    angle,
    speed: 0,
    drift: false,
    driftGauge: 0,
    boostTimer: 0,
    shieldTimer: 0,
    stunned: 0,
    item: null,
    lap: 0,
    checkpoint: 0,
    progress: 0,
    finished: false,
    finishTime: 0,
    isPlayer,
    color,
    slipAngle: 0,
    smoke: 0,
  };
}

export function updateKart(
  kart: Kart,
  dt: number,
  track: TrackData,
  controls: {
    accel: boolean;
    brake: boolean;
    left: boolean;
    right: boolean;
    drift: boolean;
  },
): void {
  if (kart.finished) {
    kart.speed = Math.max(0, kart.speed - 200 * dt);
    kart.x += Math.cos(kart.angle) * kart.speed * dt;
    kart.y += Math.sin(kart.angle) * kart.speed * dt;
    return;
  }

  if (kart.stunned > 0) {
    kart.stunned -= dt;
    kart.speed *= Math.exp(-3 * dt);
    kart.drift = false;
    kart.x += Math.cos(kart.angle) * kart.speed * dt;
    kart.y += Math.sin(kart.angle) * kart.speed * dt;
    return;
  }

  if (kart.boostTimer > 0) kart.boostTimer -= dt;
  if (kart.shieldTimer > 0) kart.shieldTimer -= dt;

  const boosting = kart.boostTimer > 0;
  const maxSpeed = boosting ? BOOST_SPEED : MAX_SPEED;
  const wantDrift =
    controls.drift &&
    kart.speed > 90 &&
    (controls.left || controls.right) &&
    !boosting;

  if (wantDrift) {
    kart.drift = true;
    kart.smoke = Math.min(1, kart.smoke + dt * 3);
    const steerDir = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
    kart.angle += steerDir * DRIFT_STEER * dt * (0.55 + kart.speed / maxSpeed);
    kart.slipAngle = lerpAngle(
      kart.slipAngle,
      steerDir * 0.55,
      1 - Math.exp(-8 * dt),
    );
    kart.driftGauge = clamp(kart.driftGauge + dt * 38, 0, 100);
    // Drift costs some forward speed but keeps momentum sideways-ish
    kart.speed = Math.max(kart.speed - 40 * dt, 110);
  } else {
    if (kart.drift && kart.driftGauge >= 28) {
      // Classic KartRider-style mini boost on drift release
      const power = kart.driftGauge / 100;
      kart.boostTimer = Math.max(kart.boostTimer, 0.35 + power * 0.55);
      kart.speed = Math.max(kart.speed, MAX_SPEED * (0.85 + power * 0.25));
    }
    kart.drift = false;
    kart.slipAngle = lerpAngle(kart.slipAngle, 0, 1 - Math.exp(-10 * dt));
    kart.smoke = Math.max(0, kart.smoke - dt * 2);
    if (!boosting) kart.driftGauge = Math.max(0, kart.driftGauge - dt * 12);
  }

  if (controls.accel) {
    kart.speed += ACCEL * dt * (boosting ? 1.35 : 1);
  } else if (controls.brake) {
    kart.speed -= BRAKE * dt;
  } else {
    kart.speed -= DRAG * 40 * dt;
  }

  if (!kart.drift) {
    const steerDir = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
    const steerScale = clamp(Math.abs(kart.speed) / 80, 0, 1);
    kart.angle += steerDir * STEER * dt * steerScale * (boosting ? 0.85 : 1);
  }

  kart.speed = clamp(kart.speed, -80, maxSpeed);

  const moveAngle = kart.angle + kart.slipAngle * 0.65;
  kart.x += Math.cos(moveAngle) * kart.speed * dt;
  kart.y += Math.sin(moveAngle) * kart.speed * dt;

  // Track bounds / off-road
  const near = closestOnPath({ x: kart.x, y: kart.y }, track.path);
  if (near.distance > track.width * 0.52) {
    kart.speed *= Math.exp(-OFFTRACK_DRAG * dt);
    // Soft push back toward track
    const pull = (near.distance - track.width * 0.5) * 2.2 * dt;
    const dx = near.point.x - kart.x;
    const dy = near.point.y - kart.y;
    const d = Math.hypot(dx, dy) || 1;
    kart.x += (dx / d) * pull;
    kart.y += (dy / d) * pull;
  }

  updateRaceProgress(kart, track);
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + normalizeAngle(b - a) * t;
}

export function updateRaceProgress(kart: Kart, track: TrackData): void {
  const cps = track.checkpoints;
  const next = cps[kart.checkpoint % cps.length];
  const d = Math.hypot(kart.x - next.x, kart.y - next.y);
  if (d < next.radius) {
    const prev = kart.checkpoint;
    kart.checkpoint = (kart.checkpoint + 1) % cps.length;
    if (prev === cps.length - 1 && kart.checkpoint === 0) {
      kart.lap += 1;
      if (kart.lap >= track.laps) {
        kart.finished = true;
        kart.lap = track.laps;
      }
    }
  }

  const near = closestOnPath({ x: kart.x, y: kart.y }, track.path);
  const seg = near.index + near.t;
  kart.progress = kart.lap * track.path.length + seg;
}

export function gridOffset(
  index: number,
  start: { x: number; y: number },
  angle: number,
): { x: number; y: number } {
  const row = Math.floor(index / 2);
  const col = index % 2;
  const back = -42 - row * 48;
  const side = col === 0 ? -28 : 28;
  return {
    x: start.x + Math.cos(angle) * back + Math.cos(angle + Math.PI / 2) * side,
    y: start.y + Math.sin(angle) * back + Math.sin(angle + Math.PI / 2) * side,
  };
}
