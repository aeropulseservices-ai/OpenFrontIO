import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { CarrierExecution } from "@openfront/engine/execution/CarrierExecution";
import { MoveWarshipExecution } from "@openfront/engine/execution/MoveWarshipExecution";
import { WarshipExecution } from "@openfront/engine/execution/WarshipExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let player: Player;
let enemy: Player;

describe("Aircraft carrier (mod)", () => {
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

  test("needs a port and sails to its patrol tile", () => {
    expect(enemy.canBuild(UnitType.AircraftCarrier, game.ref(13, 10))).toBe(
      false,
    );
    game.addExecution(new CarrierExecution(player, game.ref(13, 10)));
    executeTicks(game, 2);
    const carrier = player.units(UnitType.AircraftCarrier)[0];
    expect(carrier).toBeDefined();
    executeTicks(game, 40);
    expect(game.manhattanDist(carrier.tile(), game.ref(13, 10))).toBeLessThan(
      3,
    );
  });

  test("can be moved like a warship", () => {
    game.addExecution(new CarrierExecution(player, game.ref(13, 10)));
    executeTicks(game, 2);
    const carrier = player.units(UnitType.AircraftCarrier)[0];
    game.addExecution(
      new MoveWarshipExecution(player, [carrier.id()], game.ref(13, 3)),
    );
    executeTicks(game, 60);
    expect(carrier.warshipState().patrolTile).toBe(game.ref(13, 3));
    expect(game.manhattanDist(carrier.tile(), game.ref(13, 3))).toBeLessThan(3);
  });

  test("is an airbase for fighters and bombers", () => {
    expect(player.canBuild(UnitType.Fighter, game.ref(14, 14))).toBe(false);
    game.addExecution(new CarrierExecution(player, game.ref(13, 10)));
    executeTicks(game, 2);
    const carrier = player.units(UnitType.AircraftCarrier)[0];
    expect(player.canBuild(UnitType.Fighter, game.ref(14, 14))).toBe(
      carrier.tile(),
    );
  });

  test("enemy warships attack it", () => {
    game.addExecution(new CarrierExecution(player, game.ref(12, 10)));
    executeTicks(game, 40);
    const carrier = player.units(UnitType.AircraftCarrier)[0];
    const max = carrier.health();
    const warship = enemy.buildUnit(UnitType.Warship, game.ref(13, 10), {
      patrolTile: game.ref(13, 10),
    });
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 60);
    expect(carrier.health()).toBeLessThan(max);
  });
});
