# 05 — Objectives & Scoring

## The idea

Objectives are a **public race**. Everyone sees the same Objectives at the same time. The first villain to complete one claims it, with its reward. Because everything is in the open, you can read what your rivals are chasing, then beat them to it, deny it, or let them have it when that suits you.

## The Objective Market

- **Rule (answers Q-79):** Objectives are a shared, face-up **Objective Market**, not secret lists.
- **Rule (answers Q-79a):** the market has **players + 2** face-up Objectives (6 at 4 players), like the Dungeon, Terrain and Treasure markets. When one is claimed, the cards to its right shift left and the market refills from the Objective deck on the right. See [Markets](03-markets.md).
- **Rule (answers Q-79b):** the Objective Market **never drops its oldest card**. An Objective stays face-up until someone claims it (or a card throws it out).
- **Rule:** when the Objective deck runs out, the market just shrinks. Discarded Objectives reshuffle into the deck as usual (Q-24).
- **Rule:** nothing is dealt or revealed at setup. The market fills with the other markets.

## Claiming

- **Rule:** each Objective card prints a **reward** (for example Coins, souls, a Trick or a Minion). The villain who claims it takes the card and the reward at once.
- **Rule:** each Objective card is one of two kinds:
  - **Do it** (event, e.g. "Kill a Legendary Hero"): claimed **the moment** a villain does it. Only Objectives that were face-up when it happened count. One action can claim **several** face-up Objectives at once (replaces Q-74).
  - **Have it** (state, e.g. "Have 10 or more Coins"): **(answers Q-79c)** checked **once a round, at the end of the End Phase**, after everyone's End Phase actions. Each face-up "have it" Objective goes to the **first villain in turn order** (from the first player) who meets it then. Objectives that refill into the market during this check are checked too.
- **Rule:** a "have it" Objective must not be true at the start of the game (e.g. not "still have all 3 Villains").
- **Rule:** eliminated villains can't claim Objectives.
- **Idea:** some Tricks and powers interact with the market: peek at the next Objectives, throw a face-up one out to deny a rival, or claim a "have it" Objective early (before the End Phase check). See [Tricks](09-tricks.md).

## Winning

- **Rule:** at game end (the last Hero defeated), the **surviving** villain with the **most Objectives claimed** wins and becomes the **Overlord**.
- **Rule (answers Q-31 and Q-75):** ties go to the most **souls harvested in total**, then the most **Coins**. If they're still tied, the tied villains **share** the win.
- **Rule:** eliminated players can't win.
- **Rule (answers Q-02):** the **Heroes win** only if **every** villain is eliminated.

## Objective state (for code)

- The market is a `Market` of type `objective` (see [the data model](11-data-model.md)).
- Each player has a public `claimed` list of Objective cards.
- An Objective card has a `name`, `text`, `kind` (`event` or `state`), a `trigger` and a `reward` (a list of effects).

## Open

- Q-78: do souls gained as an Objective reward count as **harvested** (towards Treasure thresholds and the tie-break), or only as souls to spend? Assumed spendable only.
