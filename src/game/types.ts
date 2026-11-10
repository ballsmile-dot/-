export type Vec2 = { x: number; y: number };

export type ItemKind = "boost" | "banana" | "shield" | "missile";

export type KartColor = {
  body: string;
  accent: string;
  canopy: string;
};

export type Kart = {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  drift: boolean;
  driftGauge: number;
  boostTimer: number;
  shieldTimer: number;
  stunned: number;
  item: ItemKind | null;
  lap: number;
  checkpoint: number;
  progress: number;
  finished: boolean;
  finishTime: number;
  isPlayer: boolean;
  color: KartColor;
  slipAngle: number;
  smoke: number;
};

export type Banana = {
  x: number;
  y: number;
  life: number;
};

export type Missile = {
  x: number;
  y: number;
  angle: number;
  life: number;
  ownerId: string;
};

export type ItemBox = {
  x: number;
  y: number;
  respawn: number;
  pulse: number;
};

export type Checkpoint = {
  x: number;
  y: number;
  radius: number;
};

export type TrackData = {
  path: Vec2[];
  width: number;
  checkpoints: Checkpoint[];
  itemBoxes: ItemBox[];
  start: Vec2;
  startAngle: number;
  laps: number;
};
