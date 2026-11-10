import "./style.css";
import { aiControls } from "./game/ai";
import {
  bindInput,
  clearTouch,
  input,
  isCoarsePointer,
  setTouch,
} from "./game/input";
import {
  collectItemBoxes,
  ITEM_LABEL,
  ITEM_NAME,
  updateHazards,
  useItem,
} from "./game/items";
import {
  createKart,
  gridOffset,
  PALETTE,
  updateKart,
} from "./game/kart";
import {
  createCamera,
  drawWorld,
  updateCamera,
} from "./game/render";
import { createTrack } from "./game/track";
import type { Banana, Kart, Missile, TrackData } from "./game/types";

type Screen = "title" | "countdown" | "racing" | "result";

const NAMES = ["하늘", "체리", "민트", "썬"];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <canvas id="game"></canvas>
  <div class="hud hidden" id="hud">
    <div class="hud-top">
      <div class="chip"><div>랩</div><div class="big" id="lapText">1/3</div></div>
      <div class="chip"><div>순위</div><div class="big" id="rankText">1위</div></div>
      <div class="chip"><div>시간</div><div class="big" id="timeText">0:00</div></div>
    </div>
    <div class="item-slot empty" id="itemSlot">아이템</div>
    <div class="boost-wrap">
      <div class="boost-label">드리프트 게이지</div>
      <div class="boost-bar"><div class="boost-fill" id="boostFill"></div></div>
    </div>
  </div>
  <div class="countdown hidden" id="countdown"></div>
  <div class="overlay active" id="titleOverlay">
    <div class="panel">
      <div class="brand">카트러시</div>
      <p class="tagline">드리프트하고, 부스터 터뜨리고, 1등으로!</p>
      <div class="controls-hint" id="controlsHint">
        <div><span>↑ / W</span>가속</div>
        <div><span>← →</span>조향</div>
        <div><span>Shift</span>드리프트 (게이지 → 부스터)</div>
        <div><span>Space</span>아이템 사용</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="startBtn" type="button">레이스 시작</button>
      </div>
    </div>
  </div>
  <div class="overlay hidden" id="resultOverlay">
    <div class="panel">
      <div class="brand" style="font-size:2.4rem">피니시!</div>
      <p class="tagline" id="resultTitle">결과</p>
      <ul class="result-list" id="resultList"></ul>
      <div class="btn-row">
        <button class="btn secondary" id="retryBtn" type="button">다시 하기</button>
      </div>
    </div>
  </div>
  <div class="touch-controls" id="touchControls">
    <div class="pad left">
      <button type="button" data-act="left">◀</button>
      <button type="button" data-act="right">▶</button>
      <button type="button" class="wide" data-act="drift">드리프트</button>
    </div>
    <div class="pad right">
      <button type="button" data-act="item">아이템</button>
      <button type="button" data-act="down">브레이크</button>
      <button type="button" class="wide" data-act="up">가속</button>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const lapText = document.querySelector<HTMLDivElement>("#lapText")!;
const rankText = document.querySelector<HTMLDivElement>("#rankText")!;
const timeText = document.querySelector<HTMLDivElement>("#timeText")!;
const itemSlot = document.querySelector<HTMLDivElement>("#itemSlot")!;
const boostFill = document.querySelector<HTMLDivElement>("#boostFill")!;
const countdownEl = document.querySelector<HTMLDivElement>("#countdown")!;
const titleOverlay = document.querySelector<HTMLDivElement>("#titleOverlay")!;
const resultOverlay = document.querySelector<HTMLDivElement>("#resultOverlay")!;
const resultList = document.querySelector<HTMLUListElement>("#resultList")!;
const resultTitle = document.querySelector<HTMLParagraphElement>("#resultTitle")!;
const touchControls = document.querySelector<HTMLDivElement>("#touchControls")!;
const controlsHint = document.querySelector<HTMLDivElement>("#controlsHint")!;

let screen: Screen = "title";
let track: TrackData = createTrack();
let karts: Kart[] = [];
let bananas: Banana[] = [];
let missiles: Missile[] = [];
let cam = createCamera();
let raceTime = 0;
let countdown = 3;
let countdownFlash = "";
let lastTs = 0;
let anim = 0;

bindInput();
wireButtons();
resize();
syncMobileUi();
window.addEventListener("resize", () => {
  resize();
  syncMobileUi();
});
window.addEventListener("orientationchange", () => {
  resize();
  syncMobileUi();
});

document.querySelector("#startBtn")!.addEventListener("click", () => startRace());
document.querySelector("#retryBtn")!.addEventListener("click", () => startRace());

function wireButtons(): void {
  touchControls.querySelectorAll("button[data-act]").forEach((btn) => {
    const el = btn as HTMLButtonElement;
    const act = el.dataset.act!;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      setTouch(act, true);
      el.classList.add("active");
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      setTouch(act, false);
      el.classList.remove("active");
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", () => {
      setTouch(act, false);
      el.classList.remove("active");
    });
  });
}

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function syncMobileUi(): void {
  const mobile = isCoarsePointer();
  document.body.classList.toggle("mobile", mobile);
  if (mobile) {
    controlsHint.innerHTML = `
      <div><span>왼쪽</span>조향 · 드리프트</div>
      <div><span>오른쪽</span>가속 · 브레이크 · 아이템</div>
      <div>터치 패드로 플레이할 수 있어요</div>
    `;
  } else {
    controlsHint.innerHTML = `
      <div><span>↑ / W</span>가속</div>
      <div><span>← →</span>조향</div>
      <div><span>Shift</span>드리프트 (게이지 → 부스터)</div>
      <div><span>Space</span>아이템 사용</div>
    `;
  }
  const racing = screen === "countdown" || screen === "racing";
  touchControls.classList.toggle("show", mobile && racing);
}

function startRace(): void {
  track = createTrack();
  bananas = [];
  missiles = [];
  raceTime = 0;
  countdown = 3;
  countdownFlash = "3";
  cam = createCamera();

  const playerPos = gridOffset(0, track.start, track.startAngle);
  const player = createKart(
    "you",
    "플레이어",
    playerPos.x,
    playerPos.y,
    track.startAngle,
    PALETTE[0],
    true,
  );

  karts = [player];
  for (let i = 0; i < 4; i++) {
    const pos = gridOffset(i + 1, track.start, track.startAngle);
    karts.push(
      createKart(
        `ai${i}`,
        NAMES[i],
        pos.x,
        pos.y,
        track.startAngle,
        PALETTE[i + 1],
        false,
      ),
    );
  }

  titleOverlay.classList.add("hidden");
  titleOverlay.classList.remove("active");
  resultOverlay.classList.add("hidden");
  resultOverlay.classList.remove("active");
  hud.classList.remove("hidden");
  countdownEl.classList.remove("hidden");
  countdownEl.textContent = "3";
  clearTouch();
  screen = "countdown";
  syncMobileUi();
}

function finishRace(): void {
  screen = "result";
  clearTouch();
  countdownEl.classList.add("hidden");
  touchControls.classList.remove("show");
  resultOverlay.classList.remove("hidden");
  resultOverlay.classList.add("active");

  const ranked = [...karts].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });

  const playerRank = ranked.findIndex((k) => k.isPlayer) + 1;
  resultTitle.textContent =
    playerRank === 1 ? "우승! 드리프트 장인!" : `${playerRank}위로 피니시!`;

  resultList.innerHTML = ranked
    .map((k, i) => {
      const time = k.finished ? formatTime(k.finishTime) : "DNF";
      return `<li class="${k.isPlayer ? "you" : ""}"><span>${i + 1}. ${k.name}</span><span>${time}</span></li>`;
    })
    .join("");
}

function ranksMap(): Map<string, number> {
  const sorted = [...karts].sort((a, b) => b.progress - a.progress);
  const map = new Map<string, number>();
  sorted.forEach((k, i) => map.set(k.id, i));
  return map;
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function update(dt: number): void {
  anim += dt;
  const player = karts.find((k) => k.isPlayer)!;

  if (screen === "title") {
    // Idle orbit camera
    cam.x = Math.cos(anim * 0.25) * 80;
    cam.y = Math.sin(anim * 0.2) * 40;
    cam.zoom = 0.85;
    drawWorld(
      ctx,
      window.innerWidth,
      window.innerHeight,
      cam,
      track,
      [],
      [],
      [],
      anim,
    );
    return;
  }

  if (screen === "countdown") {
    countdown -= dt;
    const next =
      countdown > 2 ? "3" : countdown > 1 ? "2" : countdown > 0 ? "1" : "GO!";
    if (next !== countdownFlash) {
      countdownFlash = next;
      countdownEl.textContent = next;
      countdownEl.style.animation = "none";
      void countdownEl.offsetWidth;
      countdownEl.style.animation = "";
    }
    if (countdown <= 0) {
      screen = "racing";
      countdownEl.classList.add("hidden");
    }
    // Freeze karts but still render
    updateCamera(cam, player, dt, window.innerWidth, window.innerHeight);
    drawWorld(
      ctx,
      window.innerWidth,
      window.innerHeight,
      cam,
      track,
      karts,
      bananas,
      missiles,
      anim,
    );
    updateHud(player);
    return;
  }

  if (screen === "racing" || screen === "result") {
    if (screen === "racing") raceTime += dt;

    const ranks = ranksMap();

    for (const kart of karts) {
      if (kart.isPlayer) {
        if (screen === "racing") {
          updateKart(kart, dt, track, {
            accel: input.up,
            brake: input.down,
            left: input.left,
            right: input.right,
            drift: input.drift,
          });
          if (input.itemPressed) useItem(kart, karts, bananas, missiles);
        }
      } else if (screen === "racing" && !kart.finished) {
        const c = aiControls(kart, track, karts, anim);
        updateKart(kart, dt, track, c);
        if (c.useItem) useItem(kart, karts, bananas, missiles);
      } else {
        updateKart(
          kart,
          dt,
          track,
          { accel: false, brake: false, left: false, right: false, drift: false },
        );
      }

      if (kart.finished && kart.finishTime === 0) {
        kart.finishTime = raceTime;
      }
    }

    if (screen === "racing") {
      collectItemBoxes(karts, track, ranks, dt);
      updateHazards(karts, bananas, missiles, dt);
    }

    updateCamera(cam, player, dt, window.innerWidth, window.innerHeight);
    drawWorld(
      ctx,
      window.innerWidth,
      window.innerHeight,
      cam,
      track,
      karts,
      bananas,
      missiles,
      anim,
    );
    updateHud(player);

    if (screen === "racing" && player.finished) {
      // Let remaining AI finish briefly or end after short delay
      const allDone = karts.every((k) => k.finished);
      const topDone = karts.filter((k) => k.finished).length >= 3;
      if (allDone || topDone) finishRace();
    }

    // Safety: if player somehow never finishes but we're past long time — skip
  }
}

function updateHud(player: Kart): void {
  const lap = Math.min(player.lap + 1, track.laps);
  lapText.textContent = `${lap}/${track.laps}`;
  const sorted = [...karts].sort((a, b) => b.progress - a.progress);
  const rank = sorted.findIndex((k) => k.id === player.id) + 1;
  rankText.textContent = `${rank}위`;
  timeText.textContent = formatTime(raceTime);

  boostFill.style.width = `${Math.min(100, player.driftGauge)}%`;

  if (player.item) {
    itemSlot.classList.remove("empty");
    itemSlot.textContent = ITEM_LABEL[player.item];
    itemSlot.title = ITEM_NAME[player.item];
  } else {
    itemSlot.classList.add("empty");
    itemSlot.textContent = "아이템";
  }
}

function loop(ts: number): void {
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  dt = Math.min(dt, 0.033);
  update(dt);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
