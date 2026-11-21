import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { ParatrooperExecution } from "@openfront/engine/execution/ParatrooperExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player: Player;
let enemy: Player;

function claim(p: Player, x0: number, y0: number, size: number) {
  for (let x = x0; x < x0 + size; x++) {
    for (let y = y0; y < y0 + size; y++) p.conquer(game.ref(x, y));
  }
}

describe("Paratroopers (mod)", () => {
  beforeEach(async () => {
    game = await setup("big_plains", { instantBuild: true }, [
      new PlayerInfo("player", PlayerType.Human, null, "player_id"),
      new PlayerInfo("enemy", PlayerType.Human, null, "enemy_id"),
    ]);
    player = game.player("player_id");
    enemy = game.player("enemy_id");
    player.addGold(50_000_000n);
    claim(player, 10, 10, 20);
    claim(enemy, 80, 10, 20);
    player.setTroops(100_000);
    enemy.setTroops(1_000);
  });

  test("need an airport in range and land that isn't ours", () => {
    expect(player.canBuild(UnitType.Paratroopers, game.ref(90, 20))).toBe(
      false,
    );
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    expect(player.canBuild(UnitType.Paratroopers, game.ref(90, 20))).not.toBe(
      false,
    );
    // Unclaimed land is fine too; our own isn't.
    expect(player.canBuild(UnitType.Paratroopers, game.ref(50, 20))).not.toBe(
      false,
    );
    expect(player.canBuild(UnitType.Paratroopers, game.ref(20, 20))).toBe(
      false,
    );
  });

  test("carry a fifth of your troops and take ground where they land", () => {
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    game.addExecution(new ParatrooperExecution(player, game.ref(90, 20)));
    executeTicks(game, 2);
    const plane = player.units(UnitType.Paratroopers)[0];
    expect(plane).toBeDefined();
    expect(plane.troops()).toBe(20_000);
    expect(player.troops()).toBeLessThanOrEqual(80_000 + 1_000);
    executeTicks(game, 80);
    expect(game.units(UnitType.Paratroopers)).toHaveLength(0);
    expect(game.owner(game.ref(90, 20))).toBe(player);
  });

  test("rejoin you if their landing spot is no longer land", () => {
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    game.addExecution(new ParatrooperExecution(player, game.ref(90, 20)));
    executeTicks(game, 2);
    expect(player.units(UnitType.Paratroopers)).toHaveLength(1);
    // A water nuke turns the target into water while they're in the air.
    (game as unknown as { isLand(t: number): boolean }).isLand = (t) =>
      t !== game.ref(90, 20);
    const before = player.troops();
    executeTicks(game, 80);
    expect(game.units(UnitType.Paratroopers)).toHaveLength(0);
    expect(player.troops()).toBeGreaterThanOrEqual(before + 20_000);
  });
});
