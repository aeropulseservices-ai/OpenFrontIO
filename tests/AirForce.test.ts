import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { BomberExecution } from "@openfront/engine/execution/BomberExecution";
import { CargoPlaneExecution } from "@openfront/engine/execution/CargoPlaneExecution";
import { FighterExecution } from "@openfront/engine/execution/FighterExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { constructionExecution, executeTicks } from "./util/utils";

let game: Game;
let player: Player;
let enemy: Player;

function claim(p: Player, x0: number, y0: number, size: number) {
  for (let x = x0; x < x0 + size; x++) {
    for (let y = y0; y < y0 + size; y++) p.conquer(game.ref(x, y));
  }
}

describe("Air force (mod)", () => {
  beforeEach(async () => {
    game = await setup("big_plains", { instantBuild: true }, [
      new PlayerInfo("player", PlayerType.Human, null, "player_id"),
      new PlayerInfo("enemy", PlayerType.Human, null, "enemy_id"),
    ]);
    player = game.player("player_id");
    enemy = game.player("enemy_id");
    player.addGold(50_000_000n);
    enemy.addGold(50_000_000n);
    claim(player, 10, 10, 20);
    claim(enemy, 80, 10, 20);
  });

  test("bombers need an airport in range and a hostile target", () => {
    expect(player.canBuild(UnitType.Bomber, game.ref(90, 20))).toBe(false);
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    expect(player.canBuild(UnitType.Bomber, game.ref(90, 20))).not.toBe(false);
    // Not on our own land.
    expect(player.canBuild(UnitType.Bomber, game.ref(20, 20))).toBe(false);
  });

  test("a bomber destroys a structure at the target", () => {
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    const city = enemy.buildUnit(UnitType.City, game.ref(90, 20), {});
    const troops = enemy.troops();
    game.addExecution(new BomberExecution(player, game.ref(90, 20)));
    executeTicks(game, 120);
    expect(city.isActive()).toBe(false);
    expect(enemy.troops()).toBeLessThanOrEqual(troops);
    expect(game.units(UnitType.Bomber)).toHaveLength(0);
  });

  test("building a bomber charges gold", () => {
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    const before = player.gold();
    constructionExecution(game, player, 90, 20, UnitType.Bomber);
    expect(player.gold()).toBeLessThan(before);
  });

  test("a fighter shoots down an enemy cargo plane", () => {
    // An enemy plane flying from the enemy's airport to ours: we are not
    // allied, so our fighter on its route shoots it down.
    const a = enemy.buildUnit(UnitType.Airport, game.ref(85, 15), {});
    const b = player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    game.addExecution(new CargoPlaneExecution(enemy, a, b));
    executeTicks(game, 3);
    const plane = game.units(UnitType.CargoPlane)[0];
    expect(plane).toBeDefined();
    game.addExecution(new FighterExecution(player, game.ref(50, 15)));
    executeTicks(game, 60);
    expect(plane.isActive()).toBe(false);
  });

  test("a fighter shoots down an incoming bomber", () => {
    enemy.buildUnit(UnitType.Airport, game.ref(85, 15), {});
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    const city = player.buildUnit(UnitType.City, game.ref(20, 20), {});
    game.addExecution(new FighterExecution(player, game.ref(40, 18)));
    executeTicks(game, 15);
    game.addExecution(new BomberExecution(enemy, game.ref(20, 20)));
    executeTicks(game, 120);
    expect(city.isActive()).toBe(true);
    expect(game.units(UnitType.Bomber)).toHaveLength(0);
  });

  test("fighters return to base after their lifetime", () => {
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    game.addExecution(new FighterExecution(player, game.ref(40, 18)));
    executeTicks(game, 5);
    expect(game.units(UnitType.Fighter)).toHaveLength(1);
    executeTicks(game, game.config().fighterLifetime() + 5);
    expect(game.units(UnitType.Fighter)).toHaveLength(0);
  });
});
