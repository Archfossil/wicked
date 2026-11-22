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
| `heroes.json` | 24 | 6 per class: 3 Common, 2 Paragon, 1 Legendary |
| `villains.json` | 30 | Enough for the 6-player draft (5 drawn each) |
| `rooms.json` | 20 (43 copies) | Includes traps, Barracks, a Vault, class-treasure Rooms and soul-exchange Rooms |
| `terrain.json` | 12 (24 copies) | 3 per terrain type (Forest, Swamp, Mountain, Ruins); hazards and statuses |
| `monsters.json` | 12 (24 copies) | 3 preferring each terrain type |
| `champions.json` | 8 | Costs 2–5, each with 2 levels |
| `tricks.json` | 18 (36 copies) | All five sub-types |
| `items.json` | 12 | 3 per class |
| `treasures.json` | 14 (20 copies) | Each class at values 1/2/3, plus Gold |
| `objectives.json` | 30 | 20 event, 10 state |
| `region.json` | 1 | Deck lists and Town overflow rules |

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
| `gainCoins` / `gainMinion` / `gainTrick` | `amount` | Gain resources (a Trick is draw 2, keep 1) |
| `tempt` | `amount` | Extra tempts on a Hero in Town |
| `advanceChampion` | `amount` | Advance a Champion for free |
| `extraPlacement` | `amount` | Extra Room placement this Build Phase |
| `destroyRoom` | | Destroy a top Room |
| `moveHero` / `chooseDirection` | `amount` | Move a Hero, or pick their Overworld direction |
| `learnObjective` / `swapObjective` / `replaceObjective` | | Objective tricks |
| `raiseMonster` | | Villain power: an extra Monster move |
| `custom` | | Anything else. The engine needs a hand-written handler, or skips it |

Objective `trigger`s use the same shape (`{ op, ...args }`), e.g. `heroKilled { tier, class, where, by, carrying }` or `championCount { min }`.

## Known gaps

Things the placeholder set fills in or leaves out that a designer should look at:

- **Villain passives:** some placeholder Villains have `passive` powers. Whether Villains get passives is still **Open (Q-15)**, so the engine should support both, and the cards may change.
- **Healing cost (Q-14):** the Blood Altar (3 souls → heal 2) and Dark Pact Trick (2 souls → heal 2) are guesses at the cost.
- **Balance basics:** every number is a first guess. The main ones are below.
  - Hero stats are main stat 3/4/5 by tier, with Health 3/5/7 and desire 2/4/6.
  - Monsters and Hazards roll 2–3 dice, and Rooms roll 2–4.
  - Villains roll 4–5 dice, deal 2 damage and have 9–13 Health.
- **Starting treasure:** players start with none. The Trinket and Gold Pile Treasures have a soul threshold of 0, so everyone can buy one in the round 1 End Phase and start luring in round 2.
- **Game length:** the 24-card Hero deck means roughly 20 rounds at 4 players. It hasn't been tested.
- **Solo mode (Q-01a)** isn't supported by any card yet.
- The 18 extra Villains reuse a small pool of powers. They need unique powers.

## Tools

```
node tools/validate-data.mjs           # check fields, IDs, and how many players the set supports
node tools/placeholder-checklist.mjs   # rebuild docs/placeholders.md from the todo lists
```
