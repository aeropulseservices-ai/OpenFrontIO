// Mod: barracks. A barracks does its work through Config.troopIncreaseRate,
// which counts its owner's finished barracks levels; this execution just
// lives as long as the building, like every structure's.
import { zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

export class BarracksExecution implements Execution {
  private active = true;
  private mg: Game;

  constructor(private barracks: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (!this.barracks.isActive()) this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return BarracksExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      barracks: w.unit(this.barracks),
    });
  }

  restoreSnapshot(s: BarracksState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.barracks = r.unit(s.barracks);
  }
}

const BarracksStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  barracks: zRef(),
});
type BarracksState = z.infer<typeof BarracksStateSchema>;

export const BarracksExecutionSnapshot = execSnapshotType({
  name: "Barracks",
  version: 1,
  schema: BarracksStateSchema,
  cls: () => BarracksExecution,
});
