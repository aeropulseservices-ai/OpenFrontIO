// Mod: submarines. Built at a port and moved like a warship. It stays
// submerged: enemy warships don't hunt it, radars don't report it, and
// other players only see it for a short while after it fires. It fires
// torpedoes at hostile ships within torpedo range: heavy damage to warships
// and carriers, and transport and trade ships are sunk outright. Hostile
// warships that come close pick it up on sonar and drop depth charges.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
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

const TORPEDO_TARGETS = [
  UnitType.Warship,
  UnitType.AircraftCarrier,
  UnitType.TransportShip,
  UnitType.TradeShip,
] as const;

/** Ticks between depth-charge checks. */
const DEPTH_CHARGE_INTERVAL = 10;

export class SubmarineExecution implements Execution {
  private active = true;
  private mg: Game;
  private sub: Unit | null = null;
  private pathFinder: WaterPathFinder | null = null;
  private settledAt: TileRef | null = null;
  private reloadTicks = 0;
  /** Ticks left that the sub shows itself after firing; 0 = submerged. */
  private surfacedTicks = 0;
  private depthChargeTicks = DEPTH_CHARGE_INTERVAL;

  constructor(
    private owner: Player,
    private patrolTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathFinder ??= new WaterPathFinder(mg);
  }

  tick(ticks: number): void {
    if (this.sub === null) {
      const spawn = this.owner.canBuild(UnitType.Submarine, this.patrolTile);
      if (spawn === false) {
        this.active = false;
        return;
      }
      this.sub = this.owner.buildUnit(UnitType.Submarine, spawn, {
        patrolTile: this.patrolTile,
      });
      return;
    }
    const sub = this.sub;
    if (!sub.isActive()) {
      this.active = false;
      return;
    }
    this.takeDepthCharges(sub);
    if (!sub.isActive()) {
      this.active = false;
      return;
    }
    if (this.surfacedTicks > 0 && --this.surfacedTicks === 0) {
      sub.setTargetUnit(undefined);
    }
    // Don't keep pointing at a ship someone else sank.
    const target = sub.targetUnit();
    if (target !== undefined && !target.isActive()) sub.setTargetUnit(sub);
    if (this.reloadTicks > 0) {
      this.reloadTicks--;
    } else {
      this.fireTorpedo(sub);
    }
    this.move(sub);
  }

  private hostile(me: Player, u: Unit): boolean {
    const o = u.owner();
    return o !== me && o.isPlayer() && !me.isFriendly(o);
  }

  private fireTorpedo(sub: Unit): void {
    const me = sub.owner();
    const config = this.mg.config();
    const targets = this.mg.nearbyUnits(
      sub.tile(),
      config.submarineTorpedoRange(),
      TORPEDO_TARGETS,
      ({ unit }) => this.hostile(me, unit as Unit),
    );
    let best: { unit: Unit; distSquared: number } | null = null;
    for (const t of targets) {
      const u = t.unit as Unit;
      if (
        best === null ||
        t.distSquared < best.distSquared ||
        (t.distSquared === best.distSquared && u.id() < best.unit.id())
      ) {
        best = { unit: u, distSquared: t.distSquared };
      }
    }
    if (best === null) return;
    const victim = best.unit;
    if (
      victim.type() === UnitType.Warship ||
      victim.type() === UnitType.AircraftCarrier
    ) {
      victim.modifyHealth(-config.submarineTorpedoDamage(), me);
    } else {
      victim.delete(true, me);
    }
    this.reloadTicks = config.submarineReloadTicks();
    this.surfacedTicks = config.submarineSurfacedTicks();
    // A target marks the sub as surfaced for other players' clients; point
    // it at itself when the victim sank.
    sub.setTargetUnit(victim.isActive() ? victim : sub);
  }

  private takeDepthCharges(sub: Unit): void {
    if (--this.depthChargeTicks > 0) return;
    this.depthChargeTicks = DEPTH_CHARGE_INTERVAL;
    const me = sub.owner();
    const config = this.mg.config();
    const hunters = this.mg.nearbyUnits(
      sub.tile(),
      config.submarineSonarRange(),
      UnitType.Warship,
      ({ unit }) => this.hostile(me, unit as Unit),
    );
    hunters.sort((a, b) => a.unit.id() - b.unit.id());
    for (const { unit } of hunters) {
      if (!sub.isActive()) return;
      sub.modifyHealth(-config.depthChargeDamage(), (unit as Unit).owner());
    }
  }

  private move(sub: Unit): void {
    const dst = sub.warshipState().patrolTile;
    if (dst === undefined || dst === this.settledAt) return;
    if (sub.tile() === dst) {
      this.settledAt = dst;
      return;
    }
    const result = this.pathFinder!.next(sub.tile(), dst);
    switch (result.status) {
      case PathStatus.NEXT:
        sub.move(result.node);
        break;
      case PathStatus.COMPLETE:
        sub.move(result.node);
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
    return SubmarineExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      owner: w.player(this.owner),
      patrolTile: this.patrolTile,
      sub: w.unitOrNull(this.sub),
      pathFinder:
        this.pathFinder === null ? null : waterPathFinderState(this.pathFinder),
      settledAt: this.settledAt,
      reloadTicks: this.reloadTicks,
      surfacedTicks: this.surfacedTicks,
      depthChargeTicks: this.depthChargeTicks,
    });
  }

  restoreSnapshot(s: SubmarineState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.owner = r.player(s.owner);
    this.patrolTile = s.patrolTile;
    this.sub = r.unitOrNull(s.sub);
    this.pathFinder =
      s.pathFinder === null
        ? null
        : restoreWaterPathFinder(r.game, s.pathFinder);
    this.settledAt = s.settledAt;
    this.reloadTicks = s.reloadTicks;
    this.surfacedTicks = s.surfacedTicks;
    this.depthChargeTicks = s.depthChargeTicks;
  }
}

const SubmarineStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  owner: zPlayerRef(),
  patrolTile: zTile(),
  sub: zRef().nullable(),
  pathFinder: WaterPathFinderSchema.nullable(),
  settledAt: zTile().nullable(),
  reloadTicks: zInt(),
  surfacedTicks: zInt(),
  depthChargeTicks: zInt(),
});
type SubmarineState = z.infer<typeof SubmarineStateSchema>;

export const SubmarineExecutionSnapshot = execSnapshotType({
  name: "Submarine",
  version: 1,
  schema: SubmarineStateSchema,
  cls: () => SubmarineExecution,
});
