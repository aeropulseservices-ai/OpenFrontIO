/**
 * Fog of war (SkyFront mod): which parts of the map the local player can see.
 *
 * Purely a client view. Every client still simulates the whole game, so this
 * only decides what gets drawn. Visibility is kept on a coarse grid (one cell
 * per FOG_CELL × FOG_CELL tiles); the renderer samples it with linear
 * filtering, which turns the cell edges into a soft fog boundary.
 */

import { OWNER_MASK } from "../../gl/utils/TileCodec";

/** Tiles per fog cell along each axis. */
export const FOG_CELL = 4;

/** How far (in tiles) you see past the edge of your own or allied land. */
export const TERRITORY_SIGHT = 24;

/** A friendly unit and how far (in tiles) it sees. */
export interface FogSighter {
  x: number;
  y: number;
  radius: number;
}

export interface FogGrid {
  /** Cells across and down. */
  width: number;
  height: number;
  /** 255 = visible, 0 = fogged, one byte per cell, row-major. */
  cells: Uint8Array;
  /** Scratch: chamfer distance to friendly land, per cell. */
  dist: Uint16Array;
}

export function createFogGrid(mapW: number, mapH: number): FogGrid {
  const width = Math.ceil(mapW / FOG_CELL);
  const height = Math.ceil(mapH / FOG_CELL);
  return {
    width,
    height,
    cells: new Uint8Array(width * height),
    dist: new Uint16Array(width * height),
  };
}

/**
 * Recompute `grid` in place.
 *
 * @param tileState per-tile state (owner smallID in the low bits)
 * @param friendly  1 at each owner smallID whose land you can see from
 *                  (yourself, allies, teammates); indexed by smallID
 * @param sighters  friendly units that see around themselves
 * @param scratch   reusable buffer of at least grid.cells.length bytes
 */
export function computeFogGrid(
  grid: FogGrid,
  tileState: Uint16Array,
  mapW: number,
  mapH: number,
  friendly: Uint8Array,
  sighters: readonly FogSighter[],
  scratch: Uint8Array,
): void {
  const { width, height } = grid;
  const owned = scratch;
  owned.fill(0, 0, width * height);

  // 1. Mark every cell that holds friendly land.
  for (let y = 0; y < mapH; y++) {
    const rowBase = y * mapW;
    const cellRow = ((y / FOG_CELL) | 0) * width;
    for (let x = 0; x < mapW; x++) {
      const owner = tileState[rowBase + x] & OWNER_MASK;
      if (owner !== 0 && friendly[owner] === 1) {
        owned[cellRow + ((x / FOG_CELL) | 0)] = 1;
      }
    }
  }

  // 2. Grow it by the territory sight range, using a two-pass chamfer
  // distance transform (orthogonal step 3, diagonal step 4) so the edge of
  // what you see is round rather than square.
  const r = TERRITORY_SIGHT / FOG_CELL;
  const limit = Math.round(r * 3);
  const INF = 0xffff;
  const dist = grid.dist;
  for (let i = 0; i < width * height; i++) dist[i] = owned[i] === 1 ? 0 : INF;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[i - 1] + 3);
      if (y > 0) {
        d = Math.min(d, dist[i - width] + 3);
        if (x > 0) d = Math.min(d, dist[i - width - 1] + 4);
        if (x < width - 1) d = Math.min(d, dist[i - width + 1] + 4);
      }
      dist[i] = d;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x < width - 1) d = Math.min(d, dist[i + 1] + 3);
      if (y < height - 1) {
        d = Math.min(d, dist[i + width] + 3);
        if (x < width - 1) d = Math.min(d, dist[i + width + 1] + 4);
        if (x > 0) d = Math.min(d, dist[i + width - 1] + 4);
      }
      dist[i] = d;
    }
  }
  const cells = grid.cells;
  for (let i = 0; i < width * height; i++) {
    cells[i] = dist[i] <= limit ? 255 : 0;
  }

  // 3. Each friendly unit lights a disc around itself.
  for (const s of sighters) {
    const cx = s.x / FOG_CELL;
    const cy = s.y / FOG_CELL;
    const cr = s.radius / FOG_CELL;
    const r2 = cr * cr;
    const x0 = Math.max(0, Math.floor(cx - cr));
    const x1 = Math.min(width - 1, Math.ceil(cx + cr));
    const y0 = Math.max(0, Math.floor(cy - cr));
    const y1 = Math.min(height - 1, Math.ceil(cy + cr));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy <= r2) cells[y * width + x] = 255;
      }
    }
  }
}

/** Whether the tile at (x, y) is outside the fog. */
export function fogVisibleAt(grid: FogGrid, x: number, y: number): boolean {
  const cx = Math.floor(x / FOG_CELL);
  const cy = Math.floor(y / FOG_CELL);
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return false;
  return grid.cells[cy * grid.width + cx] !== 0;
}
