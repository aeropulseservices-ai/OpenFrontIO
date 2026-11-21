import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PassiveIncomeExecution } from "@openfront/engine/execution/PassiveIncomeExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player: Player;

function findTile(pred: (t: TileRef) => boolean): TileRef {
  for (let y = 0; y < game.height(); y++) {
    for (let x = 0; x < game.width(); x++) {
      const t = game.ref(x, y);
      if (pred(t)) return t;
    }
  }
  throw new Error("no matching tile");
}

describe("Gold sources (mod)", () => {
  beforeEach(async () => {
    game = await setup("big_plains", { instantBuild: true }, [
      new PlayerInfo("player", PlayerType.Human, null, "player_id"),
    ]);
    player = game.player("player_id");
  });

  test("city levels add tax income", () => {
    const base = game.config().goldAdditionRate(player);
    player.conquer(game.ref(50, 50));
    const city = player.buildUnit(UnitType.City, game.ref(50, 50), {});
    city.increaseLevel();
    expect(game.config().goldAdditionRate(player)).toBe(
      base + BigInt(2 * game.config().cityTaxPerLevel()),
    );
  });

  test("gold mine pays every interval, scaled by level", () => {
    player.conquer(game.ref(50, 50));
    const mine = player.buildUnit(UnitType.GoldMine, game.ref(50, 50), {});
    mine.increaseLevel();
    const exec = new PassiveIncomeExecution(mine);
    game.addExecution(exec);
    const interval = game.config().passiveIncomeInterval();
    executeTicks(game, 1);
    const before = player.gold();
    executeTicks(game, interval);
    const payout = game.config().goldMinePayout(2, player);
    const passive = game.config().goldAdditionRate(player) * BigInt(interval);
    const gained = player.gold() - before;
    expect(gained).toBeGreaterThanOrEqual(payout);
    expect(gained).toBeLessThanOrEqual(payout + passive);
  });

  test("bank interest is a share of held gold, capped per level", () => {
    const cfg = game.config();
    player.addGold(1_000_000n);
    expect(cfg.bankPayout(1, player)).toBe(5_000n);
    player.addGold(100_000_000n);
    expect(cfg.bankPayout(1, player)).toBe(25_000n);
    expect(cfg.bankPayout(2, player)).toBe(50_000n);
  });

  test("gold mines only go on highland or mountain", async () => {
    game = await setup("world", { instantBuild: true }, [
      new PlayerInfo("player", PlayerType.Human, null, "player_id"),
    ]);
    player = game.player("player_id");
    player.addGold(10_000_000n);
    const plains = findTile((t) => game.terrainType(t) === TerrainType.Plains);
    player.conquer(plains);
    const onPlains = player.canBuild(UnitType.GoldMine, plains);
    if (onPlains !== false) {
      const terrain = game.terrainType(onPlains);
      expect([TerrainType.Highland, TerrainType.Mountain]).toContain(terrain);
    }
    const high = findTile(
      (t) =>
        game.terrainType(t) === TerrainType.Highland ||
        game.terrainType(t) === TerrainType.Mountain,
    );
    player.conquer(high);
    expect(player.canBuild(UnitType.GoldMine, high)).not.toBe(false);
  });

  test("banks can be built on ordinary land", () => {
    player.conquer(game.ref(60, 60));
    player.addGold(1_000_000n);
    expect(player.canBuild(UnitType.Bank, game.ref(60, 60))).not.toBe(false);
  });
});
