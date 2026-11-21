// Mod: air force. A fighter takes off from an airport, flies to the clicked
// tile and circles it, shooting down hostile aircraft (cargo planes, bombers,
// fighters) that come near. It returns to base after fighterLifetime() ticks.
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
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { isHostileAircraftOwner, orbitPoint, stepToward } from "./AirMovement";

const AIRCRAFT_TARGETS = [
  UnitType.Bomber,
  UnitType.Fighter,
  UnitType.CargoPlane,
  UnitType.SpyPlane,
] as const;
const ORBIT_RADIUS = 8;

export class FighterExecution implements Execution {
  private active = true;
  private mg: Game;
  private fighter: Unit | null = null;
  private ticksAlive = 0;
  private lastShotTick = -1000;
  private orbitIndex = 0;
  private target: Unit | null = null;

  constructor(
    private owner: Player,
    private patrolTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.fighter === null) {
      const spawn = this.owner.canBuild(UnitType.Fighter, this.patrolTile);
      if (spawn === false) {
        this.active = false;
        return;
      }
      this.fighter = this.owner.buildUnit(UnitType.Fighter, spawn, {});
      return;
    }
    const fighter = this.fighter;
    if (!fighter.isActive()) {
      this.active = false;
      return;
    }
    const config = this.mg.config();
    if (++this.ticksAlive > config.fighterLifetime()) {
      fighter.delete(false);
      this.active = false;
      return;
    }

    const me = fighter.owner();
    if (
      this.target !== null &&
      (!this.target.isActive() || !isHostileAircraftOwner(me, this.target))
    ) {
      this.target = null;
    }
    if (this.target === null) {
      const nearby = this.mg.nearbyUnits(
        fighter.tile(),
        config.fighterDetectionRange(),
        AIRCRAFT_TARGETS,
        ({ unit }) => isHostileAircraftOwner(me, unit as Unit),
      );
      let best: { unit: Unit; distSquared: number } | null = null;
      for (const n of nearby) {
        if (
          best === null ||
          n.distSquared < best.distSquared ||
          (n.distSquared === best.distSquared && n.unit.id() < best.unit.id())
        ) {
          best = n;
        }
      }
      this.target = best?.unit ?? null;
    }

    if (this.target !== null) {
      const target = this.target;
      const dist = this.mg.manhattanDist(fighter.tile(), target.tile());
      if (dist > 1) {
        fighter.move(
          stepToward(
            this.mg,
            fighter.tile(),
            target.tile(),
            config.fighterSpeed(),
          ),
        );
      }
      if (
        this.mg.manhattanDist(fighter.tile(), target.tile()) <=
          config.fighterGunRange() &&
        ticks - this.lastShotTick >= config.fighterFireCooldown()
      ) {
        this.lastShotTick = ticks;
        target.modifyHealth(-config.fighterDamage(), me);
      }
      return;
    }

    // Fly to the patrol tile, then circle it.
    const waypoint = orbitPoint(
      this.mg,
      this.patrolTile,
      this.orbitIndex,
      ORBIT_RADIUS,
    );
    if (fighter.tile() === waypoint) {
      this.orbitIndex = (this.orbitIndex + 1) % 8;
      return;
    }
    fighter.move(
      stepToward(this.mg, fighter.tile(), waypoint, config.fighterSpeed()),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return FighterExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      owner: w.player(this.owner),
      patrolTile: this.patrolTile,
      fighter: w.unitOrNull(this.fighter),
      ticksAlive: this.ticksAlive,
      lastShotTick: this.lastShotTick,
      orbitIndex: this.orbitIndex,
      target: w.unitOrNull(this.target),
    });
  }

  restoreSnapshot(s: FighterState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.owner = r.player(s.owner);
    this.patrolTile = s.patrolTile;
    this.fighter = r.unitOrNull(s.fighter);
    this.ticksAlive = s.ticksAlive;
    this.lastShotTick = s.lastShotTick;
    this.orbitIndex = s.orbitIndex;
    this.target = r.unitOrNull(s.target);
  }
}

const FighterStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  owner: zPlayerRef(),
  patrolTile: zTile(),
  fighter: zRef().nullable(),
  ticksAlive: zInt(),
  lastShotTick: zInt(),
  orbitIndex: zInt(),
  target: zRef().nullable(),
});
type FighterState = z.infer<typeof FighterStateSchema>;

export const FighterExecutionSnapshot = execSnapshotType({
  name: "Fighter",
  version: 1,
  schema: FighterStateSchema,
  cls: () => FighterExecution,
});
