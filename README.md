# The Wicked Awaken

A competitive deckbuilding game about villains rising to meet, defeat and dominate a peaceful land of heroes (who, quite frankly, have had it too good for too long).

## Become the Villain!

In *The Wicked Awaken* you take control of a Villain, build a dungeon, lure heroes to their doom inside your vile crypt, and then use their souls to fuel your engines of malice and hatred. The goal is to build a dungeon strong enough to defeat every hero in a region, crushing all resistance so the villains become its overlords.

In this world the villains are on the back foot. The forces of good and purity won long ago, so there's little room for villainous rivalry. Not that the inconvenience of evil has ever stopped you before. Each villain has a secret list of objectives that they want to stop the other villains from achieving. When the last hero falls, the surviving villain whose list has the most objectives still unscored by the others becomes the Overlord and wins.

Beware: hobble your fellow villains too badly and the Heroes may win instead!

## Design documents

The full design lives in [`docs/design/`](docs/design/). Start with the overview.

| Doc | What it covers |
| --- | --- |
| [Overview](docs/design/00-overview.md) | Pitch, player count, components, win and loss, the overall game loop |
| [Setup](docs/design/01-setup.md) | Villain draft, opening room draft, starting Tricks |
| [Round Flow](docs/design/02-round-flow.md) | The phases of a round, in order (as far as they're known) |
| [Markets](docs/design/03-markets.md) | How the Dungeon and Terrain markets work |
| [Villains](docs/design/04-villains.md) | Villain lives, damage, souls, coins, powers |
| [Objectives & Scoring](docs/design/05-objectives-and-scoring.md) | Secret objective lists, the Overlord, tie-breaks, hero victory |
| [Dungeon & Champions](docs/design/06-dungeon-and-champions.md) | Rooms, dungeon order, Champions and paying them |
| [Overworld](docs/design/07-overworld.md) | The 4×4 terrain grid, Monsters, hero movement |
| [Heroes & Town](docs/design/08-heroes-and-town.md) | Hero classes, tiers, luring, the Town and its buildings, treasure |
| [Tricks](docs/design/09-tricks.md) | Trick cards and their sub-types (Spells and more) |
| [Regions](docs/design/10-regions.md) | Themed scenarios that change the card pools |
| [Items](docs/design/12-items.md) | Relics that buff Heroes, then become Tainted for villains |
| [Minions](docs/design/13-minions.md) | Non-combatant lackeys you send on errands |
| [Data Model](docs/design/11-data-model.md) | Draft of the game entities and their fields, for coding |
| [Glossary](docs/design/glossary.md) | Every game term in one place |
| [Open Questions](docs/design/open-questions.md) | Every undecided rule, numbered, so it can be answered later |

## Project status

Design stage, with no code yet. The docs keep **decided** rules apart from **ideas** and **open questions**, so nothing gets coded on a guess.
