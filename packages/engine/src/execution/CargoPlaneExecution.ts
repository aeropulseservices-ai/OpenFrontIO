// Mod: air commerce. A cargo plane flies in a straight line from one airport
// to another and pays both owners when it lands (see TradeShipExecution).
// Planes cannot be captured; they are lost if either airport goes away or
// the two owners stop trading.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zPlayerRef,
  zRef,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { flightPath } from "../pathfinding/FlightPath";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

export class CargoPlaneExecution implements Execution {
  private active = true;
  private mg: Game;
  private plane: Unit | undefined;
  private path: TileRef[] | null = null;
  private pathIndex = 0;
  private seed = 0;
  private srcTile: TileRef = 0;

  constructor(
    private origOwner: Player,
    private srcAirport: Unit,
    private dstAirport: Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.seed = ticks;
  }

  private ensurePath(): TileRef[] {
    this.path ??= flightPath(
      this.mg,
      this.srcTile,
      this.dstAirport.tile(),
      this.mg.config().cargoPlaneSpeed(),
      this.seed,
    );
    return this.path;
  }

  tick(ticks: number): void {
    if (this.plane === undefined) {
      if (
        !this.srcAirport.isActive() ||
        this.srcAirport.owner() !== this.origOwner
      ) {
        this.active = false;
        return;
      }
      this.srcTile = this.srcAirport.tile();
      this.plane = this.origOwner.buildUnit(UnitType.CargoPlane, this.srcTile, {
        targetUnit: this.dstAirport,
      });
      const path = this.ensurePath();
      this.mg.recordMotionPlan({
        kind: "grid",
        unitId: this.plane.id(),
        planId: 1,
        startTick: ticks + 1,
        ticksPerStep: 1,
        path,
      });
      return;
    }

    if (!this.plane.isActive()) {
      this.active = false;
      return;
    }

    const owner = this.plane.owner();
    const dstOwner = this.dstAirport.owner();
    if (
      !this.dstAirport.isActive() ||
      dstOwner === owner ||
      !owner.canTrade(dstOwner)
    ) {
      this.plane.delete(false);
      this.active = false;
      return;
    }

    const path = this.ensurePath();
    this.pathIndex++;
    if (this.pathIndex >= path.length - 1) {
      this.complete();
      return;
    }
    this.plane.move(path[this.pathIndex]);
  }

  private complete(): void {
    this.active = false;
    const plane = this.plane!;
    const owner = plane.owner();
    plane.delete(false);
    const dist = this.mg.manhattanDist(this.srcTile, this.dstAirport.tile());
    const gold = this.mg.config().cargoPlaneGold(dist, owner);
    owner.addGold(gold, this.srcTile);
    this.dstAirport.owner().addGold(gold, this.dstAirport.tile());
    owner.addTradeGold(gold);
    this.dstAirport.owner().addTradeGold(gold);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CargoPlaneExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      plane: this.plane === undefined ? null : w.unit(this.plane),
      pathIndex: this.pathIndex,
      seed: this.seed,
      srcTile: this.srcTile,
      origOwner: w.player(this.origOwner),
      srcAirport: w.unit(this.srcAirport),
      dstAirport: w.unit(this.dstAirport),
    });
  }

  restoreSnapshot(s: CargoPlaneState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.plane = s.plane === null ? undefined : r.unit(s.plane);
    this.pathIndex = s.pathIndex;
    this.seed = s.seed;
    this.srcTile = s.srcTile;
    this.origOwner = r.player(s.origOwner);
    this.srcAirport = r.unit(s.srcAirport);
    this.dstAirport = r.unit(s.dstAirport);
    // The path is derived (seeded), so it is rebuilt rather than stored.
    this.path = null;
    if (this.plane !== undefined && this.mg !== undefined) this.ensurePath();
  }
}

const CargoPlaneStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  plane: zRef().nullable(),
  pathIndex: zInt(),
  seed: zInt(),
  srcTile: zInt(),
  origOwner: zPlayerRef(),
  srcAirport: zRef(),
  dstAirport: zRef(),
});
type CargoPlaneState = z.infer<typeof CargoPlaneStateSchema>;

export const CargoPlaneExecutionSnapshot = execSnapshotType({
  name: "CargoPlane",
  version: 1,
  schema: CargoPlaneStateSchema,
  cls: () => CargoPlaneExecution,
});
