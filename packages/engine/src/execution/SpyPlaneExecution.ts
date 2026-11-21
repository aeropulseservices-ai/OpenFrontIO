// Mod: spy plane. Takes off from the nearest airport or carrier, flies to a
// rival's land and sends its owner a report on that player (troops, gold,
// buildings), then circles the spot for a while before it's done. Under
// fog of war it sees a wide circle. SAMs and fighters can shoot it down.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRandom,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { orbitPoint, stepToward } from "./AirMovement";

const ORBIT_RADIUS = 10;

export class SpyPlaneExecution implements Execution {
  private active = true;
  private mg: Game;
  private plane: Unit | null = null;
  private random: PseudoRandom;
  /** -1 until it reaches the target, then ticks left circling it. */
  private loiterTicks = -1;
  private orbitIndex = 0;

  constructor(
    private owner: Player,
    private targetTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(ticks * 37 + this.targetTile);
  }

  tick(ticks: number): void {
    if (this.plane === null) {
      const spawn = this.owner.canBuild(UnitType.SpyPlane, this.targetTile);
      if (spawn === false) {
        this.active = false;
        return;
      }
      this.plane = this.owner.buildUnit(UnitType.SpyPlane, spawn, {});
      return;
    }
    const plane = this.plane;
    if (!plane.isActive()) {
      this.active = false;
      return;
    }
    if (this.shotDownBySam()) {
      this.active = false;
      return;
    }
    const config = this.mg.config();
    if (this.loiterTicks < 0) {
      if (plane.tile() === this.targetTile) {
        this.report(plane.owner());
        this.loiterTicks = config.spyPlaneLoiterTicks();
        return;
      }
      plane.move(
        stepToward(
          this.mg,
          plane.tile(),
          this.targetTile,
          config.spyPlaneSpeed(),
        ),
      );
      return;
    }
    if (--this.loiterTicks <= 0) {
      plane.delete(false);
      this.active = false;
      return;
    }
    let waypoint = orbitPoint(
      this.mg,
      this.targetTile,
      this.orbitIndex,
      ORBIT_RADIUS,
    );
    if (plane.tile() === waypoint) {
      this.orbitIndex++;
      waypoint = orbitPoint(
        this.mg,
        this.targetTile,
        this.orbitIndex,
        ORBIT_RADIUS,
      );
    }
    plane.move(
      stepToward(this.mg, plane.tile(), waypoint, config.spyPlaneSpeed()),
    );
  }

  /** Tell the owner what the plane sees of the target's owner. */
  private report(me: Player): void {
    const target = this.mg.owner(this.targetTile);
    if (!target.isPlayer() || target === me) return;
    const count = (type: UnitType) => target.units(type).length;
    this.mg.displayMessage(
      "events_display.spy_report",
      MessageType.SPY_REPORT,
      me.id(),
      undefined,
      {
        name: target.displayName(),
        troops: Math.floor(target.troops()),
        gold: Number(target.gold()),
        cities: count(UnitType.City),
        sams: count(UnitType.SAMLauncher),
        silos: count(UnitType.MissileSilo),
        airports: count(UnitType.Airport),
      },
    );
  }

  private shotDownBySam(): boolean {
    const plane = this.plane!;
    const me = plane.owner();
    const config = this.mg.config();
    const sams = this.mg.nearbyUnits(
      plane.tile(),
      config.maxSamRange(),
      UnitType.SAMLauncher,
      ({ unit }) => {
        const o = (unit as Unit).owner();
        return o !== me && o.isPlayer() && !me.isFriendly(o);
      },
    );
    sams.sort((a, b) => a.unit.id() - b.unit.id());
    for (const { unit: sam, distSquared } of sams) {
      if (sam.isUnderConstruction()) continue;
      const range = Math.floor(
        (config.samRange(sam.level()) * config.samBomberRangePercent()) / 100,
      );
      if (distSquared > range * range) continue;
      if (this.random.chance(config.samSpyPlaneShootDownOdds())) {
        plane.modifyHealth(-plane.health(), sam.owner());
        return true;
      }
    }
    return false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return SpyPlaneExecutionSnapshot.write({
      active: this.active,
      init: this.mg !== undefined ? { random: w.random(this.random) } : null,
      owner: w.player(this.owner),
      targetTile: this.targetTile,
      plane: w.unitOrNull(this.plane),
      loiterTicks: this.loiterTicks,
      orbitIndex: this.orbitIndex,
    });
  }

  restoreSnapshot(s: SpyPlaneState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.init !== null) {
      this.mg = r.game;
      this.random = r.random(s.init.random);
    }
    this.owner = r.player(s.owner);
    this.targetTile = s.targetTile;
    this.plane = r.unitOrNull(s.plane);
    this.loiterTicks = s.loiterTicks;
    this.orbitIndex = s.orbitIndex;
  }
}

const SpyPlaneStateSchema = z.object({
  active: z.boolean(),
  init: z.object({ random: zRandom() }).nullable(),
  owner: zPlayerRef(),
  targetTile: zTile(),
  plane: zRef().nullable(),
  loiterTicks: zInt(),
  orbitIndex: zInt(),
});
type SpyPlaneState = z.infer<typeof SpyPlaneStateSchema>;

export const SpyPlaneExecutionSnapshot = execSnapshotType({
  name: "SpyPlane",
  version: 1,
  schema: SpyPlaneStateSchema,
  cls: () => SpyPlaneExecution,
});
