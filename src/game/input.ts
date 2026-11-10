export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  item: boolean;
  itemPressed: boolean;
};

const keys = new Set<string>();
let itemLatched = false;

export const input: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  drift: false,
  item: false,
  itemPressed: false,
};

const touchHeld = new Set<string>();

function refreshFromKeys(): void {
  input.up = keys.has("ArrowUp") || keys.has("KeyW") || touchHeld.has("up");
  input.down = keys.has("ArrowDown") || keys.has("KeyS") || touchHeld.has("down");
  input.left = keys.has("ArrowLeft") || keys.has("KeyA") || touchHeld.has("left");
  input.right =
    keys.has("ArrowRight") || keys.has("KeyD") || touchHeld.has("right");
  input.drift =
    keys.has("ShiftLeft") ||
    keys.has("ShiftRight") ||
    keys.has("ControlLeft") ||
    keys.has("ControlRight") ||
    touchHeld.has("drift");
  const itemDown =
    keys.has("Space") || keys.has("KeyE") || touchHeld.has("item");
  input.item = itemDown;
  input.itemPressed = itemDown && !itemLatched;
  if (itemDown) itemLatched = true;
  else itemLatched = false;
}

export function bindInput(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
      ].includes(e.code)
    ) {
      e.preventDefault();
    }
    refreshFromKeys();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    refreshFromKeys();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}

export function setTouch(action: string, down: boolean): void {
  if (down) touchHeld.add(action);
  else touchHeld.delete(action);
  refreshFromKeys();
}

export function isCoarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900;
}
