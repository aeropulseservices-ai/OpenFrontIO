# Air & Commerce mod

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
  "© OpenFront and Contributors" notice stays visible in the game, and this
  mod does not present itself as the official OpenFront game or imply
  endorsement by OpenFront Inc.

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

## Running it locally

Requires Node 24 and npm 12 (`npm i -g npm@12`).

```bash
npm run inst   # install dependencies (npm ci; don't use npm install)
npm run dev    # starts the game at http://localhost:9000
```

Open http://localhost:9000, choose **Solo**, and start a game. The new units
appear in the build bar and in the unit toggles of the game setup screen.
