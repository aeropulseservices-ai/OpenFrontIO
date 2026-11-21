// Mod: radar station. Every few ticks it sweeps its range and warns its
// owner the first time it picks up each hostile warship, carrier, transport
// or aircraft. (Under fog of war, the client also lets it see that far.)
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** Ticks between radar sweeps. */
export const RADAR_SWEEP_TICKS = 10;

/** What a radar reports. */
export const RADAR_CONTACT_TYPES = [
  UnitType.Warship,
  UnitType.AircraftCarrier,
  UnitType.TransportShip,
  UnitType.Fighter,
  UnitType.Bomber,
  UnitType.SpyPlane,
  UnitType.Paratroopers,
] as const;

export class RadarExecution implements Execution {
  private active = true;
  private mg: Game;
  private ticksUntilSweep = 0;
  /** Unit ids already reported, so each contact is announced once. */
  private seen = new Set<number>();

  constructor(private radar: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (!this.radar.isActive()) {
      this.active = false;
      return;
    }
    if (this.radar.isUnderConstruction()) return;
    if (--this.ticksUntilSweep > 0) return;
    this.ticksUntilSweep = RADAR_SWEEP_TICKS;
    this.sweep();
  }

  private sweep(): void {
    const owner = this.radar.owner();
    const range = this.mg.config().radarRange(this.radar.level());
    const contacts = this.mg.nearbyUnits(
      this.radar.tile(),
      range,
      RADAR_CONTACT_TYPES,
      ({ unit }) =>
        unit.owner() !== owner && !owner.isFriendly(unit.owner() as Player),
    );
    const inRange = new Set<number>();
    let firstNew: Unit | null = null;
    let newCount = 0;
    for (const { unit } of contacts) {
      inRange.add(unit.id());
      if (this.seen.has(unit.id())) continue;
      this.seen.add(unit.id());
      firstNew ??= unit;
      newCount++;
    }
    // Forget contacts that left range, so they're reported if they return.
    for (const id of this.seen) {
      if (!inRange.has(id)) this.seen.delete(id);
    }
    if (firstNew === null) return;
    this.mg.displayMessage(
      newCount === 1
        ? "events_display.radar_contact"
        : "events_display.radar_contacts",
      MessageType.RADAR_CONTACT,
      owner.id(),
      undefined,
      {
        unit: firstNew.type(),
        name: firstNew.owner().displayName(),
        count: newCount,
      },
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return RadarExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      radar: w.unit(this.radar),
      ticksUntilSweep: this.ticksUntilSweep,
      seen: [...this.seen].sort((a, b) => a - b),
    });
  }

  restoreSnapshot(s: RadarState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.radar = r.unit(s.radar);
    this.ticksUntilSweep = s.ticksUntilSweep;
    this.seen = new Set(s.seen);
  }
}

const RadarStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  radar: zRef(),
  ticksUntilSweep: zInt(),
  seen: z.array(zInt()),
});
type RadarState = z.infer<typeof RadarStateSchema>;

export const RadarExecutionSnapshot = execSnapshotType({
  name: "Radar",
  version: 1,
  schema: RadarStateSchema,
  cls: () => RadarExecution,
});
