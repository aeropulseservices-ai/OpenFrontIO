import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { CoastalBatteryExecution } from "@openfront/engine/execution/CoastalBatteryExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let player: Player;
let enemy: Player;

function buildBattery(): Unit {
  const battery = player.buildUnit(
    UnitType.CoastalBattery,
    game.ref(coastX, 10),
    {},
  );
  game.addExecution(new CoastalBatteryExecution(battery));
  return battery;
}

describe("Coastal battery (mod)", () => {
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
    player.conquer(game.ref(2, 2));
    executeTicks(game, 2);
  });

  test("is built on your own shore only", () => {
    expect(game.isShore(game.ref(coastX, 10))).toBe(true);
    expect(
      player.canBuild(UnitType.CoastalBattery, game.ref(coastX, 10)),
    ).not.toBe(false);
    expect(player.canBuild(UnitType.CoastalBattery, game.ref(2, 2))).toBe(
      false,
    );
    expect(game.config().coastalBatteryRange(2)).toBeGreaterThan(
      game.config().coastalBatteryRange(1),
    );
  });

  test("shells a hostile warship in range", () => {
    buildBattery();
    const warship = enemy.buildUnit(UnitType.Warship, game.ref(12, 10), {
      patrolTile: game.ref(12, 10),
    });
    const max = warship.health();
    executeTicks(game, 20);
    expect(warship.health()).toBeLessThan(max);
  });

  test("can't see a submerged submarine, but hits it once it surfaces", () => {
    buildBattery();
    const sub = enemy.buildUnit(UnitType.Submarine, game.ref(12, 10), {
      patrolTile: game.ref(12, 10),
    });
    const max = sub.health();
    executeTicks(game, 20);
    expect(sub.health()).toBe(max);
    sub.setTargetUnit(sub);
    executeTicks(game, 60);
    expect(sub.health()).toBeLessThan(max);
  });
});
