import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { AirportExecution } from "@openfront/engine/execution/AirportExecution";
import { CargoPlaneExecution } from "@openfront/engine/execution/CargoPlaneExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { constructionExecution, executeTicks } from "./util/utils";

let game: Game;
let player: Player;
let other: Player;

describe("Airport (mod)", () => {
  beforeEach(async () => {
    game = await setup("big_plains", { instantBuild: true }, [
      new PlayerInfo("player", PlayerType.Human, null, "player_id"),
      new PlayerInfo("other", PlayerType.Human, null, "other_id"),
    ]);
    player = game.player("player_id");
    other = game.player("other_id");
    player.addGold(10_000_000n);
    other.addGold(10_000_000n);
  });

  test("can be built on land away from the coast and costs gold", () => {
    player.conquer(game.ref(50, 50));
    const before = player.gold();
    constructionExecution(game, player, 50, 50, UnitType.Airport);
    expect(player.units(UnitType.Airport)).toHaveLength(1);
    expect(player.gold()).toBeLessThan(before);
  });

  test("airport lists trade partners' airports", () => {
    player.conquer(game.ref(10, 10));
    other.conquer(game.ref(150, 150));
    const a = player.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const b = other.buildUnit(UnitType.Airport, game.ref(150, 150), {});
    const exec = new AirportExecution(a);
    exec.init(game, game.ticks());
    const targets = exec.tradingAirports();
    expect(targets.map((t) => t.airport)).toContain(b);
  });

  test("cargo plane flies to the other airport and pays both owners", () => {
    player.conquer(game.ref(10, 10));
    other.conquer(game.ref(150, 150));
    const a = player.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const b = other.buildUnit(UnitType.Airport, game.ref(150, 150), {});
    const goldA = player.gold();
    const goldB = other.gold();
    game.addExecution(new CargoPlaneExecution(player, a, b));
    executeTicks(game, 2);
    expect(game.units(UnitType.CargoPlane)).toHaveLength(1);
    executeTicks(game, 300);
    expect(game.units(UnitType.CargoPlane)).toHaveLength(0);
    expect(player.gold()).toBeGreaterThan(goldA);
    expect(other.gold()).toBeGreaterThan(goldB);
  });

  test("cargo plane is lost when the destination airport is destroyed", () => {
    player.conquer(game.ref(10, 10));
    other.conquer(game.ref(150, 150));
    const a = player.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const b = other.buildUnit(UnitType.Airport, game.ref(150, 150), {});
    game.addExecution(new CargoPlaneExecution(player, a, b));
    executeTicks(game, 5);
    const goldA = player.gold();
    b.delete();
    executeTicks(game, 300);
    expect(game.units(UnitType.CargoPlane)).toHaveLength(0);
    // Only passive income, no trade payout.
    expect(player.gold() - goldA).toBeLessThan(100_000n);
  });

  test("cargo planes pay less than a trade ship over the same distance", () => {
    const cfg = game.config();
    expect(cfg.cargoPlaneGold(200, player)).toBeLessThan(
      cfg.tradeShipGold(200, player),
    );
  });
});
