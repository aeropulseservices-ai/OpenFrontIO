import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player: Player;
let enemy: Player;

describe("Barracks (mod)", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("player", PlayerType.Human, null, "player_id"),
        new PlayerInfo("enemy", PlayerType.Human, null, "enemy_id"),
      ],
    );
    player = game.player("player_id");
    enemy = game.player("enemy_id");
    player.conquer(game.ref(2, 2));
    enemy.conquer(game.ref(5, 15));
    executeTicks(game, 2);
  });

  test("is built on your own land only", () => {
    expect(player.canBuild(UnitType.Barracks, game.ref(2, 2))).not.toBe(false);
    expect(player.canBuild(UnitType.Barracks, game.ref(5, 15))).toBe(false);
  });

  test("raises troop growth, capped at +100%", () => {
    const before = game.config().troopIncreaseRate(player);
    const barracks = player.buildUnit(UnitType.Barracks, game.ref(2, 2), {});
    const withOne = game.config().troopIncreaseRate(player);
    expect(withOne).toBeGreaterThan(before);
    expect(withOne).toBeCloseTo(before * 1.1, 5);
    for (let i = 0; i < 15; i++) barracks.increaseLevel();
    expect(game.config().troopIncreaseRate(player)).toBeCloseTo(before * 2, 5);
  });
});
