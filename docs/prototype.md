# Playable prototype

A browser version of the game for playtesting the rules in [`docs/design/`](design/00-overview.md). It plays the placeholder core set in `data/core/`, for 1 to 6 villains, online or against bots.

## Run it

Needs Node.js 20 or newer.

```
npm install
npm start                 # http://localhost:3000
npm test                  # rules tests
npm run simulate -- 20 4  # 20 bot-only games at 4 players, with rough balance numbers
```

- **Create a game** and share the 4-letter code (or the `?room=CODE` link). Friends join from their own browsers. The host can add bots and change options before starting.
- **Quick game vs bots:** open `/?bots=3` (1 to 5 bots). Add `&heroes=6` for a short game with a 6-card Hero deck.
- **The screen:** the centre switches between each player's lands and the **Markets**, and the right panel between your **Villain**, **Hand** and **Objectives**. Both switch by themselves to what your turn needs, and a red **!** marks a tab with something to do. Hover any card to read it in full; open `/art.html` to see all the card art.
- Refreshing the page reconnects you to your seat. Each browser tab is its own seat, so you can play several seats from one machine to test.

## Deploy to Render

The repo has a `render.yaml` Blueprint: one Node web service that serves the page and the WebSocket server.

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and pick the repo. (Or **New → Web Service** with build command `npm install` and start command `npm start`.)
3. Share the service URL with your playtesters.

Games are kept **in memory**. A redeploy or restart ends every game in progress, and Render's free plan sleeps after about 15 idle minutes, so the first visit after that takes a while and earlier games are gone. That's fine for playtesting. Saving games would need a database.

## Code map

| Path | What it does |
| --- | --- |
| `src/engine/game.js` | Setup, the round's phases and steps, and every player action |
| `src/engine/adventure.js` | Threats, the dice-pool exchange, Hero movement, the Villain fight |
| `src/engine/effects.js` | Tricks, Villain powers, Tainted Items and Champion abilities: phases, costs, targets, effects |
| `src/engine/core.js` | Shared rules: treasure, objectives, deaths, vanquishing, Items, statuses |
| `src/engine/view.js` | What each player may see (hidden hands, reserves, objectives, secret builds) |
| `src/engine/config.js` | Constants, and the options for Open questions |
| `src/engine/bot.js` | A simple heuristic bot |
| `server/index.js` | HTTP + WebSocket server: rooms, join codes, reconnects, bots |
| `public/` | The browser client (plain HTML, CSS and JS, no build step) |
| `public/art.js` | Placeholder pixel art, drawn in code: 16x16 sprites for Villains, Heroes, Monsters and Champions, and a scene for every card. See them all at `/art.html` |

The server runs the rules and sends each player only their own view. The client never decides anything. Card text comes straight from the JSON, so editing `data/core/` changes the game with no code changes, except for `op: "custom"` effects, which have hand-written handlers keyed by card id.

## Open questions are options

Where the code meets an **Open** question it follows the design's stated assumption, and the host can switch to the alternative in the lobby under *Open rules questions*:

| Option | Default | Q |
| --- | --- | --- |
| Blind Room draws in the Town Phase | off | Q-22 |
| Terrain / Champion / Treasure markets drop their oldest card each round | on | Q-21, Q-25, Q-34b |
| Treasures you can buy per End Phase | 1 | Q-34b |
| Covered Rooms' soul exchanges work; uses per End Phase | off; 1 | Q-35a |
| Champion whose space is emptied | stays (doesn't fight) | Q-49c |
| Warrior overflow also weakens creature Rooms | off | Q-59b |
| Slowed also slows Overworld movement | off | Q-87b |
| Swapped objectives keep their status | on | Q-76 |

Fixed to the stated assumption (not yet an option): Q-80 (edge moves are forced), Q-33b (loot paid in the End Phase), Q-36d (the Shop's oldest eligible Item), Q-54d (a stolen Item is untainted, and kept only if the Hero is eligible), Q-56a (Mage ignores the *first* status each trip, Rogue skips the first trap Room each trip, Acolyte healing capped at max), Q-75 (tied players share the win), Q-86a (same-distance Heroes go in arrival order).

**Solo (Q-01a)** runs as a sandbox. Nobody can score your objectives, so the result screen just says the round is over.

## Calls the prototype makes where the design is silent

None of these is in the design docs yet. They're the simplest workable reading. Each one is worth confirming, or turning into a `Q-xx`.

**Flow and timing**
- The dungeon "entrance" is space 1. A Hero leaving (4,4) enters space 1 on the same move. There's no separate entrance round.
- A Hero lured this round resolves square (1,1) during this round's Adventure Phase, then moves from the next round on.
- Adventure Tricks and powers are all played **before** anyone moves, in turn order. Then every land resolves. This keeps Tricks out of the simultaneous resolution (see Q-86a).
- Lure Tricks are played in turn order before the lure roll. Their tempts add to that dungeon's count in the roll.
- Bleeding takes its 1 Health in the End Phase, before loot is counted. Its kill goes to the owner of the lands the Hero is in.
- A vanquished player chooses the next Villain once the Adventure Phase ends. A Hero reaching the lair before then waits in space 5.
- The Build Phase runs as: everyone builds in secret, the builds are revealed, then each player in turn plays Build Tricks. A Trick that grants an extra placement or Monster move (Rapid Construction, Stampede) can be used in that Trick turn.
- Markets drop their oldest card in round 1's Upkeep too, as written.

**Cards and effects**
- Items don't print a phase for their Tainted (villain) effect. The prototype uses: damage and dice buffs and steering in **Adventure**, statuses and Minions in **Build**, tempts in **Lure**, healing and Coins in **Build or End**, objective peeking in **Build or End**.
- Gaining a Tainted Item puts it in a free sustained slot, otherwise in the treasury. You swap which 2 you sustain in the Build or End Phase. **Giving an Item to another player isn't in yet** (Q-38).
- A Room with no threat (the Vault) that has a Champion in it: the Champion fights, testing Might.
- Learning an objective shows you a random one of that player's hidden objectives that you don't know yet.
- Town Minions with no chosen target tempt the Hero your dungeon has tempted most.
- Lucky Coin and Crystal Orb reroll automatically, once, when the Hero is losing. The Rogue's trap skip is used automatically on the first trap.
- Overseer: at its base level each Minion in its Room counts as 1 Gold, and from level 2 as 1 treasure of the Hero's own class. Its level-1 bonus is +1 die per Minion there (max 2).
- State objectives at game end can only be scored by villains still in the game.

## What simulated games say (bots, placeholder numbers)

From `npm run simulate` with the core set. Treat these as hints, not data: the bots are simple.
- **Games run long:** about 35–45 rounds, against the README's guess of about 20 at 4 players. The Hero deck runs out around round 24, and the last few Heroes then take many rounds to lure and kill.
- **Heroes almost never win.** Few Villains are vanquished: about 1–2 per game at 4–6 players.
- **Town Minions are strong.** Each one is +1 tempt every round, so a player with 5 in Town lures almost any Common Hero at once.
- **The Terrain deck is small.** With 24 Terrain cards, 3 or more players can't come close to filling their grids, so "has 16 Terrain cards" is nearly impossible to score.
