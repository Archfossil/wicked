# 00 — Overview

## Conventions used in these docs

- **Rule:** decided. Code it as written.
- **Idea:** the direction is wanted but the details aren't settled yet.
- **Open:** undecided. Each one links to an entry in [open-questions.md](open-questions.md) (`Q-xx`).

## Pitch

You play a Villain in a world where good already won. You build a dungeon, shape the wilderness in front of it, lure greedy Heroes in with treasure, kill them, and spend their souls. All villains are working to wipe out the region's Heroes, but each one secretly wants to be the *only* one left standing on top.

## Genre

A competitive **market-based deckbuilder** with a semi-cooperative twist: every villain needs the Heroes dead, but only one villain becomes Overlord.

## Players

- **Rule:** 1 to 6 players (villains).
- **Rule (answers Q-01):** **1 to 6 players**, including a **solo mode**.
- **Open:** how solo works. With no rivals there's no race for Objectives: what's the goal (e.g. claim a target number of Objectives before the Hero deck runs out)? → Q-01a

## Components (card decks)

Every game uses these decks. A [Region](10-regions.md) can swap or theme the contents of each deck.

| Deck | Purpose | Doc |
| --- | --- | --- |
| Villains | Each player drafts 3. They act as your "lives". | [Villains](04-villains.md) |
| Dungeon (Rooms) | Fills the Dungeon Market. Rooms make up your dungeon. | [Dungeon](06-dungeon-and-champions.md) |
| Champions | Hired help placed in rooms. They give bonuses and paid effects. | [Dungeon](06-dungeon-and-champions.md) |
| Tricks | One-off or reusable effects. You start with 3. | [Tricks](09-tricks.md) |
| Heroes | They gather in the Town and get lured to dungeons. | [Heroes](08-heroes-and-town.md) |
| Terrain | Fills the Terrain Market and builds your 4×4 Overworld. | [Overworld](07-overworld.md) |
| Monsters | Drafted paired with Terrain. They guard Overworld squares. | [Overworld](07-overworld.md) |
| Treasures | Fill the Treasure Market. Bought with Coins once your souls harvested reach the card's threshold; stored in your treasury to lure Heroes. | [Markets](03-markets.md) |
| Items | Appear in the Town and buff the Heroes who carry them. They become Tainted for villain use when those Heroes fall. | [Items](12-items.md) |

Other parts mentioned in the design (their exact form is still open):

- **Minions:** non-combatant lackeys you give orders to. See [Minions](13-minions.md).

- Each player's **Overworld grid** (4×4) and **Dungeon**.
- The **Town** (shared), with one building per hero class.
- Resources: **Coins** (spent), **Treasure** (lures Heroes), **Souls** (spent on prizes; your total harvested unlocks Treasures), and **Tainted Items** (up to 2 sustained).
- **Dice:** fights use d6 dice pools (5–6 = hit). Luring rolls a die only when your treasure falls short of a Hero's desire.

The phases of a round are in [Round Flow](02-round-flow.md): Upkeep → Town → Build → Lure → Adventure → End.
- The **Objective Market** (shared and face-up): goals any villain can claim, each with a reward. See [Objectives & Scoring](05-objectives-and-scoring.md).

## A hero's journey (the core loop)

```
Town ──(lured by treasure)──► Overworld 4×4 grid ──► Dungeon rooms ──► Villain fight
                                 (Terrain + Monsters)   (Rooms + Champions)
                                                                     │
                     Hero dies at any stage → villain harvests soul ◄┘
                     Hero beats the villain  → villain is vanquished (lose a life)
```

1. The villains build: they draft Rooms, Terrain/Monster pairs, Champions and Tricks.
2. Heroes gather in the Town, 1 more each round.
3. A dungeon's **treasure** tempts Heroes (a die roll against the Hero's desire). Once tempted enough, a Hero is **lured** to that dungeon.
4. The Hero crosses that villain's **Overworld**, moving one square a round.
5. If it survives, it enters the **Dungeon** and goes through the rooms, one a round.
6. If it survives the dungeon, it **fights the Villain**.
7. If the Hero dies anywhere along the way, its **soul** is harvested. If the Hero wins the fight, the villain is **vanquished**.

## How the game ends

- **Rule:** the game ends when the **last Hero in the region is defeated**. The Hero deck never reshuffles, so once it's empty the end is in sight (answers Q-24).
- **Rule (answers Q-08):** there's **no round limit** or other backstop. Heroes who keep winning keep vanquishing Villains, so eliminations end the game anyway.
- **Rule:** a player who loses all 3 villains is **eliminated**.
- **Rule:** the winner is the surviving player with the most **Objectives claimed** from the shared Objective Market. Tie-breaks: most souls harvested, then most Coins; then a shared win. See [Objectives & Scoring](05-objectives-and-scoring.md).
- **Rule:** the **Heroes win** if **every** villain is eliminated. That's the risk if the villains hobble each other too much.
