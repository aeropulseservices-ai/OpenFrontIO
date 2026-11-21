# SkyFront: an air & commerce mod of OpenFront

A personal mod of [OpenFront.io](https://github.com/openfrontio/OpenFrontIO)
(AGPL-3.0, © OpenFront and contributors). The base game is unchanged; the
features below are added on top and can each be switched off in the game's
unit settings like any other unit.

## License and attribution

This fork follows the upstream licensing exactly (see `LICENSE` and
`LICENSING.md`, which are kept unchanged):

- **Code** is AGPL v3.0, including every file this mod adds. The fork stays
  public and open source, and anyone who plays a hosted copy of it must be
  able to get its source (AGPL section 13), for example from this repository.
- **Assets** in `resources/` are CC BY-SA 4.0; the new icons and sprites this
  mod adds are released under the same license. Assets in `proprietary/` stay
  All Rights Reserved and are only used as part of the game, unmodified.
- **History**: this fork is built on top of the upstream commit history, which
  is never rewritten, squashed or force-pushed over. Mod changes are added as
  new commits through pull requests.
- **Attribution** (AGPL section 7 additional terms): the
  "© OpenFront and Contributors" notice stays visible in the footer, and this
  mod does not present itself as the official OpenFront game or imply
  endorsement by OpenFront Inc. Its title is **SkyFront (based on OpenFront)**,
  with its own logo and favicon (`resources/images/SkyFront*.svg`, CC BY-SA 4.0)
  in place of the proprietary OpenFront logo.

## Features

### Airports and air cargo

- **Airport** — land structure, built anywhere in your territory (no coast
  needed). Upgradable. Costs 125k, doubling per airport, capped at 1M.
  Hotkey: `Shift+1`.
- Each airport sends **cargo planes** to the airports of players you can trade
  with. Planes fly straight over land and sea at twice a ship's speed and pay
  both sides 60% of what a trade ship would for the same distance. Planes can't
  be captured; embargoes and losing either airport cancel the flight.
- AI nations build airports too (about one per three cities).

### More ways to earn gold

- **City taxes** — every finished city level adds 10 gold per tick (100 per
  second) on top of the normal income.
- **Bank** — land structure, upgradable. Every 10 seconds it pays 0.5% of the
  gold you're holding per level, capped at 25k per level. Costs 250k, doubling
  per bank, capped at 2M. Hotkey: `Shift+2`.
- **Gold mine** — only on highland or mountain tiles, upgradable. Pays 20k per
  level every 10 seconds. Costs 150k, doubling per mine, capped at 1M.
  Hotkey: `Shift+3`.
- AI nations build banks and gold mines too.

### Air force

- **Fighter** — 400k (+100k per fighter you have, max 800k), hotkey `Shift+4`.
  Click any tile within 350 tiles of one of your airports: the fighter takes
  off from the nearest airport, circles that spot and shoots down hostile
  aircraft (enemy bombers, fighters and cargo planes) that come within 25
  tiles. It stays up for 3 minutes, then returns to base.
- **Bomber** — 600k (+150k per bomber, max 1.2M), hotkey `Shift+5`. Click an
  enemy's land within 350 tiles of an airport: the bomber flies there, destroys
  the nearest building within 8 tiles of the target and kills 5% of that
  player's troops. Enemy SAM launchers can shoot it down when it flies inside
  60% of their nuke range, and enemy fighters intercept it. You can't bomb
  allies or teammates.

### Aircraft carriers

- **Aircraft carrier**: 2M (+1M per carrier you have, max 4M), hotkey
  `Shift+6`. It's built from a port like a warship and has 2000 health. It
  carries no guns of its own; instead it works as a floating airport, so
  fighters and bombers can launch from it, out to 350 tiles from wherever it
  is. Click it to select it, then click water to move it, the same way you move
  warships. Enemy warships hunt carriers first, so keep yours escorted.

### Spy planes

- **Spy Plane**: 250k (+50k per spy plane, max 500k), hotkey `Shift+8`.
  Click a rival's land within 350 tiles of one of your airports or carriers.
  The plane flies there and sends you a report in the events feed: that
  player's troops, gold, and how many cities, SAMs, missile silos and
  airports they have. It then circles the spot for 30 seconds (and with fog
  of war on, it sees 45 tiles around itself). Enemy fighters can shoot it
  down, and so can SAMs, though less often than bombers.

### Paratroopers

- **Paratroopers**: 300k (+100k per plane in the air, max 600k), hotkey
  `Shift+9`. Click any land you don't own (an enemy's or unclaimed) within
  350 tiles of one of your airports or carriers. A transport plane takes a
  fifth of your troops there, even deep inland, and drops them: they take
  the tile they land on and attack from it, like troops coming off a boat.
  SAMs and enemy fighters can shoot the plane down, and the troops on board
  are lost with it.

### Submarines

- **Submarine**: 750k (+250k per submarine, max 1.5M), hotkey `Shift+0`,
  800 health. Built from a port like a warship and moved the same way
  (click it, then click water). It stays submerged: other players can't see
  it, enemy warships don't hunt it, and radars don't report it. Every 3
  seconds it fires a torpedo at the nearest hostile ship within 12 tiles:
  500 damage to warships and carriers, and transport and trade ships are
  sunk outright. It shows itself for 3 seconds each time it fires. Hostile
  warships that get within 8 tiles find it on sonar and drop depth charges.

### Radar stations

- **Radar Station**: 150k (doubling per station, max 600k), hotkey
  `Shift+7`. Build it on your own land; upgrade it for more range (80 tiles,
  +20 per level). It warns you in the events feed the first time it picks up
  each hostile warship, carrier, transport ship, fighter or bomber in range.
  With fog of war on, it also lets you see its whole range.

### Barracks

- **Barracks**: 200k (doubling per barracks, max 1M), hotkey `Shift+Z`.
  Build it on your own land. Each barracks level adds 10% to your troop
  growth, up to +100% in total. Upgrade it or build more to stack the bonus.

### Coastal batteries

- **Coastal Battery**: 250k (doubling per battery, max 1M), hotkey
  `Shift+V`. Build it on your own coastline. Every 3 seconds it shells the
  nearest hostile warship, carrier or transport ship within 25 tiles (+5 per
  level). Submarines are only targeted while surfaced after firing a torpedo.

### Fog of war

Turn on **Fog of War** in the game settings (single player or a private
lobby) to play without seeing the whole map. You see your own and your
allies' land plus about 24 tiles around it, and a circle around each of your
ships and aircraft (warships and fighters 30 tiles, carriers 35, bombers 20,
transports and cargo planes 15, trade ships 12). Everything else shows as
dark bare terrain: enemy land, buildings, units and names are hidden until
you get close. Your scouting matters: send a fighter or warship to look.

The fog is drawn by your own game client only, so it's for fun with friends
rather than a cheat-proof competitive mode.

## Desktop app on Windows

`desktop/windows/` turns your local copy into an installed program:

1. Install [Node.js 24](https://nodejs.org) (the installer tries `winget`
   for you if it's missing) and clone this repository.
2. Double-click **`desktop/windows/Install SkyFront.cmd`**. It installs the
   game's dependencies and adds a **SkyFront** icon to your Desktop and Start
   menu, plus an entry in Settings > Apps so it can be uninstalled.
3. Double-click the SkyFront icon. It starts the game server in the
   background (the first start takes a minute) and opens the game in its own
   window.

The server keeps running after you close the window, so the next start is
instant. Use **Stop SkyFront server** in the Start menu to stop it.

## Running it locally

Requires Node 24 and npm 12 (`npm i -g npm@12`).

```bash
npm run inst   # install dependencies (npm ci; don't use npm install)
npm run dev    # starts the game at http://localhost:9000
```

Open http://localhost:9000, choose **Solo**, and start a game. The new units
appear in the build bar and in the unit toggles of the game setup screen.
