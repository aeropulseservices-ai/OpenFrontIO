import { describe, expect, it } from "vitest";
import {
  computeFogGrid,
  createFogGrid,
  FOG_CELL,
  fogVisibleAt,
  TERRITORY_SIGHT,
} from "../../src/client/render/frame/derive/FogOfWar";

const W = 200;
const H = 120;

function run(
  ownerAt: (x: number, y: number) => number,
  friendlyIds: number[],
  sighters: { x: number; y: number; radius: number }[] = [],
) {
  const tiles = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) tiles[y * W + x] = ownerAt(x, y);
  }
  const friendly = new Uint8Array(4096);
  for (const id of friendlyIds) friendly[id] = 1;
  const grid = createFogGrid(W, H);
  computeFogGrid(
    grid,
    tiles,
    W,
    H,
    friendly,
    sighters,
    new Uint8Array(grid.cells.length),
  );
  return grid;
}

describe("fog of war visibility", () => {
  it("sees own land and a margin around it, not beyond", () => {
    // Player 1 owns x < 40; player 2 owns x >= 150.
    const grid = run((x) => (x < 40 ? 1 : x >= 150 ? 2 : 0), [1]);
    expect(fogVisibleAt(grid, 10, 60)).toBe(true);
    expect(fogVisibleAt(grid, 40 + TERRITORY_SIGHT - FOG_CELL, 60)).toBe(true);
    expect(fogVisibleAt(grid, 40 + TERRITORY_SIGHT + 2 * FOG_CELL, 60)).toBe(
      false,
    );
    expect(fogVisibleAt(grid, 170, 60)).toBe(false);
  });

  it("allies' land counts as seen", () => {
    const grid = run((x) => (x < 40 ? 1 : x >= 150 ? 2 : 0), [1, 2]);
    expect(fogVisibleAt(grid, 170, 60)).toBe(true);
    expect(fogVisibleAt(grid, 100, 60)).toBe(false);
  });

  it("units light a disc around themselves", () => {
    const grid = run(() => 0, [1], [{ x: 100, y: 60, radius: 20 }]);
    expect(fogVisibleAt(grid, 100, 60)).toBe(true);
    expect(fogVisibleAt(grid, 112, 60)).toBe(true);
    expect(fogVisibleAt(grid, 130, 60)).toBe(false);
    expect(fogVisibleAt(grid, 10, 10)).toBe(false);
  });

  it("everything is fogged with nothing friendly", () => {
    const grid = run((x) => (x < 40 ? 2 : 0), [1]);
    expect(grid.cells.every((c) => c === 0)).toBe(true);
  });
});
