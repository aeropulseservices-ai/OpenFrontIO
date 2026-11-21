// Mod: paratroopers. A transport plane takes a fifth of your troops from the
// nearest airport or carrier within range, flies them over any land you
// don't own (even far inland), and drops them: they take the tile they land
// on and attack from there, like troops coming off a boat. SAMs and fighters
// can shoot the plane down, and the troops aboard are lost with it.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
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
import { stepToward } from "./AirMovement";
import { AttackExecution } from "./AttackExecution";

export class ParatrooperExecution implements Execution {
  private active = true;
  private mg: Game;
  private plane: Unit | null = null;
  private random: PseudoRandom;

  constructor(
    private owner: Player,
    private targetTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(ticks * 41 + this.targetTile);
  }

  tick(ticks: number): void {
    if (this.plane === null) {
      const spawn = this.owner.canBuild(UnitType.Paratroopers, this.targetTile);
      if (spawn === false) {
        this.active = false;
        return;
      }
      const target = this.mg.owner(this.targetTile);
      const troops = Math.min(
        this.owner.troops(),
        this.mg.config().boatAttackAmount(this.owner, target),
      );
      if (troops <= 0) {
        this.active = false;
        return;
      }
      this.owner.removeTroops(troops);
      this.plane = this.owner.buildUnit(UnitType.Paratroopers, spawn, {
        troops,
      });
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
    if (plane.tile() === this.targetTile) {
      this.drop(plane);
      plane.delete(false);
      this.active = false;
      return;
    }
    plane.move(
      stepToward(
        this.mg,
        plane.tile(),
        this.targetTile,
        this.mg.config().paratrooperSpeed(),
      ),
    );
  }

  private drop(plane: Unit): void {
    const me = plane.owner();
    const troops = plane.troops();
    const target = this.mg.owner(this.targetTile);
    // Our land now, a friend's, or no longer land at all (a water nuke hit
    // it): the troops just rejoin us.
    if (
      target === me ||
      (target.isPlayer() && me.isFriendly(target)) ||
      !this.mg.isLand(this.targetTile) ||
      this.mg.isImpassable(this.targetTile)
    ) {
      me.addTroops(troops);
      return;
    }
    me.conquer(this.targetTile);
    this.mg.addExecution(
      new AttackExecution(troops, me, target.id(), this.targetTile, false),
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
      if (this.random.chance(config.samBomberShootDownOdds())) {
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
    return ParatrooperExecutionSnapshot.write({
      active: this.active,
      init: this.mg !== undefined ? { random: w.random(this.random) } : null,
      owner: w.player(this.owner),
      targetTile: this.targetTile,
      plane: w.unitOrNull(this.plane),
    });
  }

  restoreSnapshot(s: ParatrooperState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.init !== null) {
      this.mg = r.game;
      this.random = r.random(s.init.random);
    }
    this.owner = r.player(s.owner);
    this.targetTile = s.targetTile;
    this.plane = r.unitOrNull(s.plane);
  }
}

const ParatrooperStateSchema = z.object({
  active: z.boolean(),
  init: z.object({ random: zRandom() }).nullable(),
  owner: zPlayerRef(),
  targetTile: zTile(),
  plane: zRef().nullable(),
});
type ParatrooperState = z.infer<typeof ParatrooperStateSchema>;

export const ParatrooperExecutionSnapshot = execSnapshotType({
  name: "Paratrooper",
  version: 1,
  schema: ParatrooperStateSchema,
  cls: () => ParatrooperExecution,
});
