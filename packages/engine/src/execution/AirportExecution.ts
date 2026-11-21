// Mod: air commerce. An airport sends cargo planes to the airports of players
// it can trade with, the same way a port sends trade ships (see PortExecution).
// Planes need no shared water body, so landlocked players can trade too.
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zRandom,
  zRef,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { CargoPlaneExecution } from "./CargoPlaneExecution";

export interface WeightedAirport {
  airport: Unit;
  weight: number;
}

export class AirportExecution implements Execution {
  private active = true;
  private mg: Game;
  private random: PseudoRandom;
  private checkOffset: number;
  private spawnRejections = 0;

  constructor(private airport: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(mg.ticks() + 7919);
    this.checkOffset = mg.ticks() % 10;
  }

  tick(ticks: number): void {
    if (!this.airport.isActive()) {
      this.active = false;
      return;
    }
    if (this.airport.isUnderConstruction()) {
      return;
    }
    // Only check every 10 ticks for performance.
    if ((this.mg.ticks() + this.checkOffset) % 10 !== 0) {
      return;
    }
    if (!this.shouldSpawnCargoPlane()) {
      return;
    }
    const dst = this.pickAirport(this.tradingAirports());
    if (dst === null) {
      return;
    }
    this.mg.addExecution(
      new CargoPlaneExecution(this.airport.owner(), this.airport, dst),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  shouldSpawnCargoPlane(): boolean {
    const numPlanes = this.mg.unitCount(UnitType.CargoPlane);
    const levels = this.airport.owner().unitCount(UnitType.Airport);
    for (let i = 0; i < this.airport.level(); i++) {
      const rate = this.mg
        .config()
        .cargoPlaneSpawnRate(this.spawnRejections, numPlanes, levels);
      if (this.random.chance(rate)) {
        this.spawnRejections = 0;
        return true;
      }
      this.spawnRejections++;
    }
    return false;
  }

  tradingAirports(): WeightedAirport[] {
    const owner = this.airport.owner();
    const config = this.mg.config();
    const airports = this.mg
      .players()
      .filter((p) => p !== owner && p.canTrade(owner))
      .flatMap((p) => p.units(UnitType.Airport))
      .filter((a) => a.isActive() && !a.isUnderConstruction())
      .sort(
        (a, b) =>
          this.mg.manhattanDist(this.airport.tile(), a.tile()) -
          this.mg.manhattanDist(this.airport.tile(), b.tile()),
      );
    return airports.map((other, i) => {
      let multiplier = 1;
      const tooClose =
        this.mg.manhattanDist(this.airport.tile(), other.tile()) <
        config.tradeShipShortRangeDebuff();
      if (!tooClose && i < config.proximityBonusPortsNb(airports.length)) {
        multiplier++;
      }
      if (!tooClose && owner.isFriendly(other.owner())) {
        multiplier++;
      }
      return { airport: other, weight: other.level() * multiplier };
    });
  }

  pickAirport(airports: WeightedAirport[]): Unit | null {
    let total = 0;
    for (const { weight } of airports) total += weight;
    if (total === 0) return null;
    let roll = this.random.nextInt(0, total);
    for (const { airport, weight } of airports) {
      if (roll < weight) return airport;
      roll -= weight;
    }
    throw new Error("unreachable: roll exceeded total weight");
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    const initialized = this.mg !== undefined;
    return AirportExecutionSnapshot.write({
      active: this.active,
      airport: w.unit(this.airport),
      init: initialized
        ? { random: w.random(this.random), checkOffset: this.checkOffset }
        : null,
      spawnRejections: this.spawnRejections,
    });
  }

  restoreSnapshot(s: AirportState, r: SnapshotReader): void {
    this.active = s.active;
    this.airport = r.unit(s.airport);
    if (s.init !== null) {
      this.mg = r.game;
      this.random = r.random(s.init.random);
      this.checkOffset = s.init.checkOffset;
    }
    this.spawnRejections = s.spawnRejections;
  }
}

const AirportStateSchema = z.object({
  active: z.boolean(),
  airport: zRef(),
  init: z.object({ random: zRandom(), checkOffset: zInt() }).nullable(),
  spawnRejections: zInt(),
});
type AirportState = z.infer<typeof AirportStateSchema>;

export const AirportExecutionSnapshot = execSnapshotType({
  name: "Airport",
  version: 1,
  schema: AirportStateSchema,
  cls: () => AirportExecution,
});
