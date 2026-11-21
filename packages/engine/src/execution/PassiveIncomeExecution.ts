// Mod: extra gold sources. Runs a bank or a gold mine: every
// passiveIncomeInterval() ticks the owner is paid, scaled by the level.
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

export class PassiveIncomeExecution implements Execution {
  private active = true;
  private mg: Game;
  private ticksUntilPayout = -1;

  constructor(private structure: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (this.ticksUntilPayout < 0) {
      this.ticksUntilPayout = mg.config().passiveIncomeInterval();
    }
  }

  tick(ticks: number): void {
    if (!this.structure.isActive()) {
      this.active = false;
      return;
    }
    if (this.structure.isUnderConstruction()) {
      return;
    }
    if (--this.ticksUntilPayout > 0) {
      return;
    }
    this.ticksUntilPayout = this.mg.config().passiveIncomeInterval();
    const owner = this.structure.owner();
    const level = this.structure.level();
    const gold =
      this.structure.type() === UnitType.Bank
        ? this.mg.config().bankPayout(level, owner)
        : this.mg.config().goldMinePayout(level, owner);
    if (gold > 0n) {
      owner.addGold(gold, this.structure.tile());
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return PassiveIncomeExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      structure: w.unit(this.structure),
      ticksUntilPayout: this.ticksUntilPayout,
    });
  }

  restoreSnapshot(s: PassiveIncomeState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.structure = r.unit(s.structure);
    this.ticksUntilPayout = s.ticksUntilPayout;
  }
}

const PassiveIncomeStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  structure: zRef(),
  ticksUntilPayout: zInt(),
});
type PassiveIncomeState = z.infer<typeof PassiveIncomeStateSchema>;

export const PassiveIncomeExecutionSnapshot = execSnapshotType({
  name: "PassiveIncome",
  version: 1,
  schema: PassiveIncomeStateSchema,
  cls: () => PassiveIncomeExecution,
});
