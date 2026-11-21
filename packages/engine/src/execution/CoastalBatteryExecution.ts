// Mod: coastal battery. A shore gun that shells the nearest hostile ship in
// range: warships, carriers, transport ships, and submarines while they're
// surfaced after firing.
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { ShellExecution } from "./ShellExecution";

/** Ticks between shots. */
export const COASTAL_BATTERY_RELOAD_TICKS = 30;

/** What a coastal battery shoots at. */
export const COASTAL_BATTERY_TARGET_TYPES = [
  UnitType.Warship,
  UnitType.AircraftCarrier,
  UnitType.TransportShip,
  UnitType.Submarine,
] as const;

export class CoastalBatteryExecution implements Execution {
  private active = true;
  private mg: Game;
  private reload = 0;

  constructor(private battery: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (!this.battery.isActive()) {
      this.active = false;
      return;
    }
    if (this.battery.isUnderConstruction()) return;
    if (this.reload > 0) {
      this.reload--;
      return;
    }
    const target = this.findTarget();
    if (target === undefined) return;
    this.mg.addExecution(
      new ShellExecution(
        this.battery.tile(),
        this.battery.owner(),
        this.battery,
        target,
      ),
    );
    this.reload = COASTAL_BATTERY_RELOAD_TICKS;
  }

  private findTarget(): Unit | undefined {
    const owner = this.battery.owner();
    const range = this.mg.config().coastalBatteryRange(this.battery.level());
    let best: Unit | undefined;
    let bestDist = Infinity;
    for (const { unit, distSquared } of this.mg.nearbyUnits(
      this.battery.tile(),
      range,
      COASTAL_BATTERY_TARGET_TYPES,
    )) {
      if (unit.owner() === owner) continue;
      if (!owner.canAttackPlayer(unit.owner() as Player, true)) continue;
      // A submerged submarine can't be seen.
      if (
        unit.type() === UnitType.Submarine &&
        unit.targetUnit() === undefined
      ) {
        continue;
      }
      if (distSquared < bestDist) {
        best = unit;
        bestDist = distSquared;
      }
    }
    return best;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CoastalBatteryExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      battery: w.unit(this.battery),
      reload: this.reload,
    });
  }

  restoreSnapshot(s: CoastalBatteryState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.battery = r.unit(s.battery);
    this.reload = s.reload;
  }
}

const CoastalBatteryStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  battery: zRef(),
  reload: zInt(),
});
type CoastalBatteryState = z.infer<typeof CoastalBatteryStateSchema>;

export const CoastalBatteryExecutionSnapshot = execSnapshotType({
  name: "CoastalBattery",
  version: 1,
  schema: CoastalBatteryStateSchema,
  cls: () => CoastalBatteryExecution,
});
