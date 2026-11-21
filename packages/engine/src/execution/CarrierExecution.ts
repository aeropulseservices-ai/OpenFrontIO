// Mod: aircraft carriers. A carrier is built at a port like a warship and
// sails to its patrol tile, which the owner can change like a warship's. It
// fires no shells: it is a mobile airbase that fighters and bombers can take
// off from (see PlayerImpl.airBases). Enemy warships target it.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import {
  restoreWaterPathFinder,
  WaterPathFinderSchema,
  waterPathFinderState,
} from "../snapshot/PathfinderSnapshots";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

export class CarrierExecution implements Execution {
  private active = true;
  private mg: Game;
  private carrier: Unit | null = null;
  private pathFinder: WaterPathFinder | null = null;
  /** Set once the current patrol tile has been reached or found unreachable. */
  private settledAt: TileRef | null = null;

  constructor(
    private owner: Player,
    private patrolTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathFinder ??= new WaterPathFinder(mg);
  }

  tick(ticks: number): void {
    if (this.carrier === null) {
      const spawn = this.owner.canBuild(
        UnitType.AircraftCarrier,
        this.patrolTile,
      );
      if (spawn === false) {
        this.active = false;
        return;
      }
      this.carrier = this.owner.buildUnit(UnitType.AircraftCarrier, spawn, {
        patrolTile: this.patrolTile,
      });
      return;
    }
    const carrier = this.carrier;
    if (!carrier.isActive()) {
      this.active = false;
      return;
    }
    const dst = carrier.warshipState().patrolTile;
    if (dst === undefined || dst === this.settledAt) return;
    if (carrier.tile() === dst) {
      this.settledAt = dst;
      return;
    }
    const result = this.pathFinder!.next(carrier.tile(), dst);
    switch (result.status) {
      case PathStatus.NEXT:
        carrier.move(result.node);
        break;
      case PathStatus.COMPLETE:
        carrier.move(result.node);
        this.settledAt = dst;
        break;
      case PathStatus.NOT_FOUND:
        this.settledAt = dst;
        break;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CarrierExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      owner: w.player(this.owner),
      patrolTile: this.patrolTile,
      carrier: w.unitOrNull(this.carrier),
      pathFinder:
        this.pathFinder === null ? null : waterPathFinderState(this.pathFinder),
      settledAt: this.settledAt,
    });
  }

  restoreSnapshot(s: CarrierState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.owner = r.player(s.owner);
    this.patrolTile = s.patrolTile;
    this.carrier = r.unitOrNull(s.carrier);
    this.pathFinder =
      s.pathFinder === null
        ? null
        : restoreWaterPathFinder(r.game, s.pathFinder);
    this.settledAt = s.settledAt;
  }
}

const CarrierStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  owner: zPlayerRef(),
  patrolTile: zTile(),
  carrier: zRef().nullable(),
  pathFinder: WaterPathFinderSchema.nullable(),
  settledAt: zTile().nullable(),
});
type CarrierState = z.infer<typeof CarrierStateSchema>;

export const CarrierExecutionSnapshot = execSnapshotType({
  name: "Carrier",
  version: 1,
  schema: CarrierStateSchema,
  cls: () => CarrierExecution,
});
