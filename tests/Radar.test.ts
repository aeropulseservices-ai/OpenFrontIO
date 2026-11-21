import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { RadarExecution } from "@openfront/engine/execution/RadarExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player: Player;
let enemy: Player;

function radarMessages(spy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return spy.mock.calls.filter(
    (c: unknown[]) => c[1] === MessageType.RADAR_CONTACT,
  );
}

describe("Radar station (mod)", () => {
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

  test("is built on your own land and gets longer range with levels", () => {
    expect(player.canBuild(UnitType.Radar, game.ref(2, 2))).not.toBe(false);
    expect(player.canBuild(UnitType.Radar, game.ref(5, 15))).toBe(false);
    expect(game.config().radarRange(2)).toBeGreaterThan(
      game.config().radarRange(1),
    );
  });

  test("reports each hostile warship once while it stays in range", () => {
    const spy = vi.spyOn(game, "displayMessage");
    const radar = player.buildUnit(UnitType.Radar, game.ref(2, 2), {});
    game.addExecution(new RadarExecution(radar));
    executeTicks(game, 2);
    enemy.buildUnit(UnitType.Warship, game.ref(13, 10), {
      patrolTile: game.ref(13, 10),
    });
    executeTicks(game, 25);
    const calls = radarMessages(spy);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toBe(player.id());
    expect(calls[0][0]).toBe("events_display.radar_contact");
    executeTicks(game, 40);
    expect(radarMessages(spy)).toHaveLength(1);
  });

  test("ignores your own units", () => {
    const spy = vi.spyOn(game, "displayMessage");
    const radar = player.buildUnit(UnitType.Radar, game.ref(2, 2), {});
    game.addExecution(new RadarExecution(radar));
    player.buildUnit(UnitType.Warship, game.ref(13, 10), {
      patrolTile: game.ref(13, 10),
    });
    executeTicks(game, 25);
    expect(radarMessages(spy)).toHaveLength(0);
  });
});
