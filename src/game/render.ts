import { curbPolylines } from "./track";
import type { Banana, ItemBox, Kart, Missile, TrackData, Vec2 } from "./types";
import { ITEM_LABEL } from "./items";

export type Camera = { x: number; y: number; zoom: number };

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 };
}

export function updateCamera(
  cam: Camera,
  target: Kart,
  dt: number,
  w: number,
  h: number,
): void {
  const lead = 40 + target.speed * 0.12;
  const tx = target.x + Math.cos(target.angle) * lead;
  const ty = target.y + Math.sin(target.angle) * lead;
  const k = 1 - Math.exp(-5 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const wantZoom = Math.min(1.15, Math.max(0.72, 900 / Math.min(w, h)));
  cam.zoom += (wantZoom - cam.zoom) * (1 - Math.exp(-3 * dt));
}

let curbCache: { left: Vec2[]; right: Vec2[] } | null = null;
let curbKey = "";

function getCurbs(track: TrackData) {
  const key = `${track.path.length}:${track.width}`;
  if (!curbCache || curbKey !== key) {
    curbCache = curbPolylines(track.path, track.width * 0.5);
    curbKey = key;
  }
  return curbCache;
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera,
  track: TrackData,
  karts: Kart[],
  bananas: Banana[],
  missiles: Missile[],
  time: number,
): void {
  // Sky / grass backdrop
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#7dd3fc");
  g.addColorStop(0.45, "#86efac");
  g.addColorStop(1, "#4ade80");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Soft hills
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 6; i++) {
    const hx = ((i * 211 + time * 8) % (w + 200)) - 100;
    const hy = h * 0.35 + (i % 3) * 30;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 120 + i * 20, 40, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#166534";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawTrack(ctx, track, time);
  drawItemBoxes(ctx, track.itemBoxes, time);

  for (const b of bananas) drawBanana(ctx, b, time);
  for (const m of missiles) drawMissile(ctx, m);

  const sorted = [...karts].sort((a, b) => a.y - b.y);
  for (const kart of sorted) drawKart(ctx, kart, time);

  ctx.restore();
}

function drawTrack(ctx: CanvasRenderingContext2D, track: TrackData, time: number): void {
  const { left, right } = getCurbs(track);

  // Grass shadow under track
  ctx.beginPath();
  for (let i = 0; i < left.length; i++) {
    const p = left[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    const p = right[i];
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(20, 83, 45, 0.25)";
  ctx.fill();

  // Asphalt
  ctx.beginPath();
  for (let i = 0; i < left.length; i++) {
    const p = left[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    ctx.lineTo(right[i].x, right[i].y);
  }
  ctx.closePath();
  const asphalt = ctx.createLinearGradient(-600, -400, 600, 400);
  asphalt.addColorStop(0, "#334155");
  asphalt.addColorStop(0.5, "#475569");
  asphalt.addColorStop(1, "#334155");
  ctx.fillStyle = asphalt;
  ctx.fill();

  // Red/white curbs
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  for (const side of [left, right]) {
    for (let i = 0; i < side.length; i++) {
      const a = side[i];
      const b = side[(i + 1) % side.length];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = i % 2 === 0 ? "#f8fafc" : "#ef4444";
      ctx.stroke();
    }
  }

  // Center dashed line
  ctx.save();
  ctx.setLineDash([18, 16]);
  ctx.strokeStyle = "rgba(253, 224, 71, 0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  track.path.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Start/finish
  const s = track.path[0];
  const n = track.path[1];
  const ang = Math.atan2(n.y - s.y, n.x - s.x);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(ang);
  const hw = track.width * 0.48;
  for (let i = -5; i < 5; i++) {
    ctx.fillStyle = (i + Math.floor(time * 2)) % 2 === 0 ? "#fff" : "#0f172a";
    ctx.fillRect(-6, (i * hw) / 5, 12, hw / 5);
  }
  ctx.restore();
}

function drawItemBoxes(ctx: CanvasRenderingContext2D, boxes: ItemBox[], time: number): void {
  for (const box of boxes) {
    if (box.respawn > 0) continue;
    const bob = Math.sin(box.pulse) * 4;
    ctx.save();
    ctx.translate(box.x, box.y + bob);
    ctx.rotate(time * 1.5);
    const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
    grd.addColorStop(0, "#fef9c3");
    grd.addColorStop(0.5, "#38bdf8");
    grd.addColorStop(1, "#6366f1");
    ctx.fillStyle = grd;
    roundRect(ctx, -14, -14, 28, 28, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Nunito";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.rotate(-time * 1.5);
    ctx.fillText("?", 0, 1);
    ctx.restore();
  }
}

function drawBanana(ctx: CanvasRenderingContext2D, b: Banana, time: number): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.sin(time * 3 + b.x) * 0.2);
  ctx.font = "22px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🍌", 0, 0);
  ctx.restore();
}

function drawMissile(ctx: CanvasRenderingContext2D, m: Missile): void {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.angle);
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -7);
  ctx.lineTo(-10, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(-12, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKart(ctx: CanvasRenderingContext2D, kart: Kart, time: number): void {
  ctx.save();
  ctx.translate(kart.x, kart.y);
  ctx.rotate(kart.angle + kart.slipAngle * 0.35);

  // Drift smoke
  if (kart.smoke > 0.05) {
    ctx.globalAlpha = kart.smoke * 0.45;
    ctx.fillStyle = "#cbd5e1";
    for (let i = 0; i < 3; i++) {
      const ox = -18 - i * 8;
      const oy = (i % 2 === 0 ? -10 : 10) + Math.sin(time * 20 + i) * 2;
      ctx.beginPath();
      ctx.ellipse(ox, oy, 8 + i * 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Boost trail
  if (kart.boostTimer > 0) {
    const grd = ctx.createLinearGradient(-40, 0, -10, 0);
    grd.addColorStop(0, "rgba(34, 211, 238, 0)");
    grd.addColorStop(1, "rgba(251, 191, 36, 0.85)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(-48 - Math.sin(time * 40) * 4, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
  }

  // Shadow
  ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
  ctx.beginPath();
  ctx.ellipse(2, 8, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = kart.color.body;
  roundRect(ctx, -18, -12, 36, 24, 10);
  ctx.fill();
  ctx.fillStyle = kart.color.accent;
  roundRect(ctx, -8, -12, 18, 24, 8);
  ctx.fill();

  // Canopy / face
  ctx.fillStyle = kart.color.canopy;
  roundRect(ctx, 2, -8, 14, 16, 6);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(8, -3, 2.2, 0, Math.PI * 2);
  ctx.arc(8, 3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(7.3, -3.6, 0.7, 0, Math.PI * 2);
  ctx.arc(7.3, 2.4, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = "#0f172a";
  roundRect(ctx, -16, -15, 10, 5, 2);
  roundRect(ctx, -16, 10, 10, 5, 2);
  roundRect(ctx, 6, -15, 10, 5, 2);
  roundRect(ctx, 6, 10, 10, 5, 2);

  // Shield
  if (kart.shieldTimer > 0) {
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + Math.sin(time * 10) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stun stars
  if (kart.stunned > 0) {
    ctx.font = "14px serif";
    ctx.textAlign = "center";
    ctx.fillText("💫", Math.cos(time * 8) * 16, -24);
  }

  // Player marker
  if (kart.isPlayer) {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(5, -20);
    ctx.lineTo(-5, -20);
    ctx.closePath();
    ctx.fill();
  }

  // Held item hint above AI optional — skip for clutter

  ctx.restore();

  // Nameplate in world space upright
  ctx.save();
  ctx.translate(kart.x, kart.y - 34);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const label = kart.isPlayer ? "YOU" : kart.name;
  ctx.font = "bold 11px Nunito";
  const tw = ctx.measureText(label).width;
  roundRect(ctx, -tw / 2 - 6, -8, tw + 12, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#0c4a6e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 1);
  if (kart.item && !kart.isPlayer) {
    ctx.font = "12px serif";
    ctx.fillText(ITEM_LABEL[kart.item], tw / 2 + 14, 0);
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
