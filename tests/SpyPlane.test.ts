import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { FighterExecution } from "@openfront/engine/execution/FighterExecution";
import { SpyPlaneExecution } from "@openfront/engine/execution/SpyPlaneExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
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

describe("Spy plane (mod)", () => {
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

  test("needs an airport in range and a rival's land", () => {
    expect(player.canBuild(UnitType.SpyPlane, game.ref(90, 20))).toBe(false);
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    expect(player.canBuild(UnitType.SpyPlane, game.ref(90, 20))).not.toBe(
      false,
    );
    expect(player.canBuild(UnitType.SpyPlane, game.ref(20, 20))).toBe(false);
  });

  test("reports on the target, circles, then lands", () => {
    const spy = vi.spyOn(game, "displayMessage");
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    enemy.buildUnit(UnitType.City, game.ref(90, 20), {});
    game.addExecution(new SpyPlaneExecution(player, game.ref(90, 20)));
    executeTicks(game, 60);
    const reports = spy.mock.calls.filter(
      (c: unknown[]) => c[1] === MessageType.SPY_REPORT,
    );
    expect(reports).toHaveLength(1);
    expect(reports[0][2]).toBe(player.id());
    expect(reports[0][4]).toMatchObject({
      name: enemy.displayName(),
      cities: 1,
    });
    // Still up while circling...
    expect(game.units(UnitType.SpyPlane)).toHaveLength(1);
    // ...and gone once its loiter time is up.
    executeTicks(game, game.config().spyPlaneLoiterTicks() + 5);
    expect(game.units(UnitType.SpyPlane)).toHaveLength(0);
  });

  test("enemy fighters shoot it down", () => {
    player.buildUnit(UnitType.Airport, game.ref(15, 15), {});
    enemy.buildUnit(UnitType.Airport, game.ref(85, 15), {});
    game.addExecution(new FighterExecution(enemy, game.ref(88, 20)));
    executeTicks(game, 10);
    game.addExecution(new SpyPlaneExecution(player, game.ref(90, 20)));
    executeTicks(game, 120);
    expect(game.units(UnitType.SpyPlane)).toHaveLength(0);
  });
});
