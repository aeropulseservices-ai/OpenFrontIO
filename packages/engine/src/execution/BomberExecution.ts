// Mod: air force. A bomber takes off from an airport, flies straight to the
// target and destroys the nearest hostile structure within
// bomberBlastRadius(), killing some of the target owner's troops. SAM
// launchers can shoot it down on the way, and fighters can intercept it.
import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  MessageType,
  Structures,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
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

export class BomberExecution implements Execution {
  private active = true;
  private mg: Game;
  private bomber: Unit | null = null;
  private random: PseudoRandom;

  constructor(
    private owner: Player,
    private targetTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(ticks * 31 + this.targetTile);
  }

  tick(ticks: number): void {
    if (this.bomber === null) {
      const spawn = this.owner.canBuild(UnitType.Bomber, this.targetTile);
      if (spawn === false) {
        this.active = false;
        return;
      }
      this.bomber = this.owner.buildUnit(UnitType.Bomber, spawn, {});
      return;
    }
    const bomber = this.bomber;
    if (!bomber.isActive()) {
      this.active = false;
      return;
    }
    const me = bomber.owner();
    const targetOwner = this.mg.owner(this.targetTile);
    // Called off if the target is no longer hostile (taken over, alliance).
    if (
      !targetOwner.isPlayer() ||
      targetOwner === me ||
      me.isFriendly(targetOwner)
    ) {
      bomber.delete(false);
      this.active = false;
      return;
    }

    if (this.shotDownBySam()) {
      this.active = false;
      return;
    }

    if (bomber.tile() === this.targetTile) {
      this.dropBombs(me, targetOwner);
      bomber.delete(false);
      this.active = false;
      return;
    }
    bomber.move(
      stepToward(
        this.mg,
        bomber.tile(),
        this.targetTile,
        this.mg.config().bomberSpeed(),
      ),
    );
  }

  private shotDownBySam(): boolean {
    const bomber = this.bomber!;
    const me = bomber.owner();
    const config = this.mg.config();
    const sams = this.mg.nearbyUnits(
      bomber.tile(),
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
        bomber.modifyHealth(-bomber.health(), sam.owner());
        return true;
      }
    }
    return false;
  }

  private dropBombs(me: Player, targetOwner: Player): void {
    const config = this.mg.config();
    const structures = this.mg.nearbyUnits(
      this.targetTile,
      config.bomberBlastRadius(),
      Structures.types,
      ({ unit }) => (unit as Unit).owner() === targetOwner,
      true,
    );
    let best: { unit: Unit; distSquared: number } | null = null;
    for (const s of structures) {
      if (
        best === null ||
        s.distSquared < best.distSquared ||
        (s.distSquared === best.distSquared && s.unit.id() < best.unit.id())
      ) {
        best = s;
      }
    }
    if (best !== null) {
      best.unit.delete(true, me);
    }
    const killed = Math.floor(
      (targetOwner.troops() * config.bomberTroopKillPercent()) / 100,
    );
    if (killed > 0) targetOwner.removeTroops(killed);
    this.mg.displayMessage(
      "events_display.bombed_by",
      MessageType.UNIT_DESTROYED,
      targetOwner.id(),
      undefined,
      { name: me.displayName() },
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return BomberExecutionSnapshot.write({
      active: this.active,
      init: this.mg !== undefined ? { random: w.random(this.random) } : null,
      owner: w.player(this.owner),
      targetTile: this.targetTile,
      bomber: w.unitOrNull(this.bomber),
    });
  }

  restoreSnapshot(s: BomberState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.init !== null) {
      this.mg = r.game;
      this.random = r.random(s.init.random);
    }
    this.owner = r.player(s.owner);
    this.targetTile = s.targetTile;
    this.bomber = r.unitOrNull(s.bomber);
  }
}

const BomberStateSchema = z.object({
  active: z.boolean(),
  init: z.object({ random: zRandom() }).nullable(),
  owner: zPlayerRef(),
  targetTile: zTile(),
  bomber: zRef().nullable(),
});
type BomberState = z.infer<typeof BomberStateSchema>;

export const BomberExecutionSnapshot = execSnapshotType({
  name: "Bomber",
  version: 1,
  schema: BomberStateSchema,
  cls: () => BomberExecution,
});
