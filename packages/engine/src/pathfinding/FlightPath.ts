// Mod: aircraft. A straight-ish flight path over any terrain, sampled every
// `speed` tiles so a unit following it advances `speed` tiles per tick. The
// first entry is `from` and the last is always `to`.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { Game } from "../game/Game";
import { AirPathFinder } from "./PathFinder.Air";

export function flightPath(
  game: Game,
  from: TileRef,
  to: TileRef,
  speed: number,
  seed: number,
): TileRef[] {
  const pf = new AirPathFinder(game);
  pf.setSeed(seed);
  const full = pf.findPath(from, to) ?? [from, to];
  const step = Math.max(1, Math.floor(speed));
  const out: TileRef[] = [];
  for (let i = 0; i < full.length; i += step) {
    out.push(full[i]);
  }
  if (out[out.length - 1] !== full[full.length - 1]) {
    out.push(full[full.length - 1]);
  }
  return out;
}
