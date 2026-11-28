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
- **The screen:** the centre switches between each player's lands and the **Markets**, and the right panel between your **Villain**, **Hand** and **Objectives**. Both switch by themselves to what your turn needs, and a red **!** marks a tab with something to do. Hover any card, or any Overworld square, to read it in full. **Click a Terrain square** for its details (the Terrain, the Monster's stats as it fights there, the Heroes on it), and **click any Hero** for their character sheet (Health, printed stats and the dice they roll now, status effects with rounds left, class passive, Item, and how close each dungeon is to luring them); open `/art.html` to see all the card art.
- **A player's lands:** the Overworld board fills the left of the centre. Arrows between squares show the way Heroes walk, and light up where a Hero can step next. Beside the board are a summary (Terrain filled, types, Monsters at home) and **On the road**, the Heroes in these lands and how far each has to go, then the Treasury. The Dungeon is below the board, and waiting Champions, Tainted Items and Minions are below the Dungeon.
- **Objectives:** the right panel's **Objectives** tab (and the bottom of **Markets**) shows the face-up Objective Market with each card's reward. "Have it" Objectives show every villain's progress (e.g. `Sludge 6/10`), so you can see who is about to claim what. Below that is everyone's claimed count, the race that decides the Overlord. Each player tab shows 🎯 claimed.
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
| Souls from Objective rewards count as harvested | off | Q-78 |

Fixed to the stated assumption (not yet an option): Q-80 (edge moves are forced), Q-33b (loot paid in the End Phase), Q-36d (the Shop's oldest eligible Item), Q-54d (a stolen Item is untainted, and kept only if the Hero is eligible), Q-56a (Mage ignores the *first* status each trip, Rogue skips the first trap Room each trip, Acolyte healing capped at max), Q-86a (same-distance Heroes go in arrival order).

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
- Items don't print a phase for their Tainted (villain) effect. The prototype uses: damage and dice buffs and steering in **Adventure**, statuses and Minions in **Build**, tempts in **Lure**, healing and Coins in **Build or End**, Objective peeking in **Build or End**.
- Gaining a Tainted Item puts it in a free sustained slot, otherwise in the treasury. You swap which 2 you sustain in the Build or End Phase. **Giving an Item to another player isn't in yet** (Q-38).
- A Room with no threat (the Vault) that has a Champion in it: the Champion fights, testing Might.
- Town Minions with no chosen target tempt the Hero your dungeon has tempted most.
- Lucky Coin and Crystal Orb reroll automatically, once, when the Hero is losing. The Rogue's trap skip is used automatically on the first trap.
- Overseer: at its base level each Minion in its Room counts as 1 Gold, and from level 2 as 1 treasure of the Hero's own class. Its level-1 bonus is +1 die per Minion there (max 2).
- Objectives: rewards are paid at once, and a Trick won from a reward is the usual draw 2, keep 1. A "do it" event claims only Objectives that were face-up when it happened, not ones that refill into the market as a result. The Objective cards and their rewards are placeholders.

## What simulated games say (bots, placeholder numbers)

From `npm run simulate` with the core set. Treat these as hints, not data: the bots are simple.
- **Game length:** about 32 rounds at 2–6 players (20 to 60), with the 24-card Hero deck each game deals from the 72-Hero pool. That's still longer than the README's guess of about 20 at 4 players: once the Hero deck is empty, the last few Heroes take many rounds to lure and kill.
- **Heroes almost never win.** Few Villains are vanquished: about 1–2 per game at 4–6 players.
- **Town Minions are strong.** Each one is +1 tempt every round, so a player with 5 in Town lures almost any Common Hero at once.
- **Terrain fills up now.** The Terrain and Monster decks went from 24 to 96 cards each. Before, the 24 Terrain cards capped every Overworld in the game combined (about 6 squares each at 4 players, 4 at 6 players). Now bots fill all 16 squares in about 90% of games at 4 players and nearly always at 6. The bots draft Terrain eagerly, though, so the "Master of the Wilds" Objective (Terrain on all 16 squares) may be too easy. Worth watching with people.
- **Objectives get claimed.** With 60 Objectives, about 7 are claimed per game at 2 players, 11 at 4 and 14 at 6 (between 48 and 54 different ones over 30 games). The winner claims about 5–6, with a lead of 2–3 over second place. The bots don't chase Objectives on purpose (they claim them by accident while playing as before), so these numbers say more about the cards than about strategy.
- **Deck sizes.** Every deck was grown so games don't run out. Before, the Dungeon, Champion and Treasure markets emptied in every game. Bot games with padded decks measured real demand. Rooms are the hungriest at about 6 a round at 6 players, because players stack a Room most rounds and never give it back. Treasures stay bought, so they run down too. With 358 Rooms and 157 Treasures, no deck ran short in 120 bot games (4 and 6 players); by the numbers they last to about round 60 at 6 players. The game is digital-only, so big decks cost nothing.
- **Push-back must not repeat every round.** Anything that moves an Overworld Hero back a square and can be used every round (an every-round Villain power or a recharging Tainted Item) can trap a Hero forever: they step forward, get pushed back, and an Acolyte heals as fast as they're hurt. That happened in testing and nothing ended the game (Q-08: no backstop). Shadow Step only recharges every 3 rounds, so Heroes still advance. Keep push-back on slow recharges or one-shot cards.
