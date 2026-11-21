// Mod: aircraft. Straight-line movement over any terrain, deterministic and
// integer-only. A diagonal step counts as one step.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { Game, Player, Unit } from "../game/Game";

export function stepToward(
  game: Game,
  from: TileRef,
  to: TileRef,
  steps: number,
): TileRef {
  let x = game.x(from);
  let y = game.y(from);
  const tx = game.x(to);
  const ty = game.y(to);
  for (let i = 0; i < steps; i++) {
    const dx = tx - x;
    const dy = ty - y;
    if (dx === 0 && dy === 0) break;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (dx !== 0 && adx * 2 >= ady) x += Math.sign(dx);
    if (dy !== 0 && ady * 2 >= adx) y += Math.sign(dy);
  }
  return game.ref(x, y);
}

/** Tile offset `radius` away from `center` in one of 8 compass directions, clamped to the map. */
export function orbitPoint(
  game: Game,
  center: TileRef,
  index: number,
  radius: number,
): TileRef {
  const dirs = [
    [1, 0],
    [3, 3],
    [0, 1],
    [-3, 3],
    [-1, 0],
    [-3, -3],
    [0, -1],
    [3, -3],
  ];
  const [ux, uy] = dirs[((index % 8) + 8) % 8];
  // Diagonals are scaled by 3/4 per axis so the ring is roughly round.
  const diag = ux !== 0 && uy !== 0;
  const ox = diag ? Math.trunc((ux * radius) / 4) : ux * radius;
  const oy = diag ? Math.trunc((uy * radius) / 4) : uy * radius;
  const x = Math.min(game.width() - 1, Math.max(0, game.x(center) + ox));
  const y = Math.min(game.height() - 1, Math.max(0, game.y(center) + oy));
  return game.ref(x, y);
}

/** Whether `unit` belongs to someone `me` should shoot at. */
export function isHostileAircraftOwner(me: Player, unit: Unit): boolean {
  const other = unit.owner();
  return other !== me && other.isPlayer() && !me.isFriendly(other);
}
