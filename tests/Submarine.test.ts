import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { MoveWarshipExecution } from "@openfront/engine/execution/MoveWarshipExecution";
import { SubmarineExecution } from "@openfront/engine/execution/SubmarineExecution";
import { WarshipExecution } from "@openfront/engine/execution/WarshipExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let player: Player;
let enemy: Player;

function launchSub(at: number, y = 10): Unit {
  game.addExecution(new SubmarineExecution(player, game.ref(at, y)));
  executeTicks(game, 2);
  return player.units(UnitType.Submarine)[0];
}

describe("Submarine (mod)", () => {
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
    player.conquer(game.ref(coastX, 10));
    player.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
    executeTicks(game, 5);
  });

  test("needs a port and can be moved like a warship", () => {
    expect(enemy.canBuild(UnitType.Submarine, game.ref(13, 10))).toBe(false);
    const sub = launchSub(13);
    expect(sub).toBeDefined();
    game.addExecution(
      new MoveWarshipExecution(player, [sub.id()], game.ref(13, 3)),
    );
    executeTicks(game, 60);
    expect(game.manhattanDist(sub.tile(), game.ref(13, 3))).toBeLessThan(3);
  });

  test("torpedoes a nearby enemy warship and surfaces when it fires", () => {
    const sub = launchSub(12, 1);
    executeTicks(game, 20);
    expect(sub.tile()).toBe(game.ref(12, 1));
    expect(sub.targetUnit()).toBeUndefined();
    // 10 tiles away: in torpedo range, out of sonar range.
    const warship = enemy.buildUnit(UnitType.Warship, game.ref(12, 11), {
      patrolTile: game.ref(12, 11),
    });
    const max = warship.health();
    executeTicks(game, 2);
    expect(warship.health()).toBeLessThanOrEqual(
      max - game.config().submarineTorpedoDamage(),
    );
    expect(sub.targetUnit()).toBeDefined();
    // Nothing left to shoot: it dives again.
    if (warship.isActive()) warship.delete(false);
    executeTicks(game, game.config().submarineSurfacedTicks() + 1);
    expect(sub.targetUnit()).toBeUndefined();
    expect(sub.health()).toBe(sub.maxHealth());
  });

  test("enemy warships don't target it but depth-charge it up close", () => {
    const sub = launchSub(12);
    executeTicks(game, 20);
    const warship = enemy.buildUnit(UnitType.Warship, game.ref(14, 10), {
      patrolTile: game.ref(14, 10),
    });
    game.addExecution(new WarshipExecution(warship));
    const max = sub.health();
    executeTicks(game, 25);
    expect(warship.targetUnit()?.type()).not.toBe(UnitType.Submarine);
    expect(sub.health()).toBeLessThan(max);
  });
});
