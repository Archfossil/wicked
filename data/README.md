# Card data

Card definitions live here as JSON, one folder per set. The rules engine reads these files, so cards can change without code changes (see [the data model](../docs/design/11-data-model.md)).

> **Everything in `core/` is a placeholder.** Names, numbers and wording were made up so the mechanics can be tested. None of it is playtested or final. The art and design sweep is tracked in [`docs/placeholders.md`](../docs/placeholders.md).

## Sets

| Folder | What it is |
| --- | --- |
| `core/` | The generic, unthemed starter set for the first prototype (answers Q-91). It has enough cards for 1–6 players. |

## Files in a set

| File | Cards | Notes |
| --- | --- | --- |
| `heroes.json` | 72 | The Hero **pool**: 18 per class (9 Common, 6 Paragon, 3 Legendary). Each game deals its own 24-card Hero deck from it (see `region.json`) |
| `villains.json` | 48 | Enough for the 6-player draft (5 drawn each) with 18 left over |
| `rooms.json` | 40 (358 copies) | Traps, creature Rooms, Barracks and Hatcheries, Vaults and class hoards, status Rooms, soul-exchange Rooms. Sized so the deck lasts to about round 60 at 6 players |
| `terrain.json` | 36 (140 copies) | 9 per terrain type (Forest, Swamp, Mountain, Ruins), 35 copies of each type; hazards and statuses. Enough for every grid to fill at 6 players |
| `monsters.json` | 28 (140 copies) | 7 preferring each terrain type. The home bonus is +1 die or +1 damage (`preferredBonus` with `addDice` or `addDamage`) |
| `champions.json` | 18 (43 copies) | Costs 2–5, each with 2 levels |
| `tricks.json` | 30 (80 copies) | All five sub-types |
| `items.json` | 28 | 7 per class |
| `treasures.json` | 19 (157 copies) | Each class at values 1/2/3/4, plus Gold 3/6/9. Sized so the deck lasts to about round 60 at 6 players |
| `objectives.json` | 60 | The Objective Market: 35 "do it" (event), 25 "have it" (state). Each has a `name` and a `reward` |
| `region.json` | 1 | Deck lists, the Hero deck's shape (`heroDeck.perClass`) and Town overflow rules |

## Conventions

- **`id`** is stable and never shown to players. Rename cards by changing `name`, not `id`.
- **`copies`** is how many of the card go in the deck (default 1).
- **`todo`** lists what's still a placeholder: `name`, `flavour`, `art`, `wording`, `balance`. Remove an entry when it's final, then run `node tools/placeholder-checklist.mjs`.
- **`flavour`** is `"TODO"` and **`art`** is `null` until the art and design team fills them in.
- **Hero `stats.health`** is the printed value. Class passives (e.g. Warrior +1 Health) are applied by the rules, not baked into the card.
- **Threats** are `{ tests, dice, damage, rank }`, as in [Combat](../docs/design/02-round-flow.md#combat-dice-pool).
- **`trap: true`** marks trap Rooms (they test Cunning).
- **Terrain `statusRounds`** is the printed duration of a Status Terrain (this field is new to the data model).

## Effects (draft)

The effect language is still to be designed. For now every effect is `{ op, ...args, text }`:

- `text` is the human-readable card text. It's the source of truth while the language is a draft.
- `op` is a keyword the engine can switch on. An engine that doesn't know an `op` should log `text` and skip it.
- `when` says when it applies: `passive`, `upkeep`, `end`, `onEnter` (a Hero enters this Room), `afterWin` (this card won an exchange against a Hero), `whileOnTop`. With no `when`, the effect is played or activated (Tricks, soul exchanges, Tainted Items).
- `recharges: true` on a Villain power means it's used once, then recharges in Upkeep.
- `target` is one of `self`, `room`, `topRoom`, `lastRoom`, `trapRoom`, `monster`, `champion`, `villain`, `any`.

| `op` | Args | Meaning |
| --- | --- | --- |
| `addDice` | `amount`, `target` or `stat` | Extra dice for a threat, or for a Hero stat (Items) |
| `addDamage` | `amount`, `target` | Extra (or less, if negative) damage |
| `inflictStatus` | `status`, `rounds` | Give a Hero a timed status |
| `heroLoseHealth` | `amount` | Direct damage to a Hero |
| `healVillain` | `amount` | Heal your active Villain |
| `gainCoins` / `gainSouls` / `gainMinion` / `gainTrick` | `amount` | Gain resources (a Trick is draw 2, keep 1). `gainSouls` is only used by Objective rewards. A soul exchange can give `gainCoins`, `gainMinion`, `gainTrick`, `healVillain` or `advanceChampion` |
| `tempt` | `amount` | Extra tempts on a Hero in Town |
| `advanceChampion` | `amount` | Advance a Champion for free |
| `extraPlacement` | `amount` | Extra Room placement this Build Phase |
| `destroyRoom` | | Destroy a top Room |
| `moveHero` / `chooseDirection` | `amount` | Move a Hero, or pick their Overworld direction |
| `peekObjective` / `replaceObjective` / `claimObjective` | `amount` | Objective Market tricks: look at the top cards of the Objective deck; throw out a face-up Objective; claim a "have it" Objective you meet now |
| `raiseMonster` | | Villain power: an extra Monster move |
| `custom` | | Anything else. The engine needs a hand-written handler, or skips it |

Objective `trigger`s use the same shape (`{ op, ...args }`), e.g. `heroKilled { tier, class, where, by, carrying }` or `championCount { min }`. A `state` trigger needs a `min` of 1 or more, so nobody meets it at the start. Objective `reward`s are effects.

## Known gaps

Things the placeholder set fills in or leaves out that a designer should look at:

- **Villain passives:** some placeholder Villains have `passive` powers. Whether Villains get passives is still **Open (Q-15)**, so the engine should support both, and the cards may change.
- **Healing cost (Q-14):** the Blood Altar (3 souls → heal 2) and Dark Pact Trick (2 souls → heal 2) are guesses at the cost.
- **Balance basics:** every number is a first guess. The main ones are below.
  - Hero stats are main stat 3/4/5 by tier, with Health 3/5/7 and desire 2/4/6.
  - Monsters and Hazards roll 2–3 dice (a few 2-dice ones deal 2 damage), and Rooms roll 2–4.
  - Villains roll 4–5 dice, deal 2 damage and have 9–13 Health.
- **Starting treasure:** players start with none. The Trinket and Gold Pile Treasures have a soul threshold of 0, so everyone can buy one in the round 1 End Phase and start luring in round 2.
- **Game length:** each game's 24-card Hero deck means roughly 30–35 rounds with bots (the Hero pool is bigger, but each game still deals 24).
- **Solo mode (Q-01a)** isn't supported by any card yet.
- Most of the Villains reuse a small pool of generic powers (all within the effect ops above). They need unique powers.
- **Deck sizes** were set from bot games with padded decks: Rooms and Treasures are the hungry decks, because dungeons stack a Room most rounds and bought Treasures stay bought. See [the prototype notes](../docs/prototype.md#what-simulated-games-say-bots-placeholder-numbers).

## Tools

```
node tools/validate-data.mjs           # check fields, IDs, and how many players the set supports
node tools/placeholder-checklist.mjs   # rebuild docs/placeholders.md from the todo lists
```
