# Air & Commerce mod

A personal mod of [OpenFront.io](https://github.com/openfrontio/OpenFrontIO)
(AGPL-3.0, © OpenFront and contributors). The base game is unchanged; the
features below are added on top and can each be switched off in the game's
unit settings like any other unit.

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
