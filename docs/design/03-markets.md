# 03 — Markets

There are five shared markets that work the same way. In code they should share one `Market` type.

| Market | Deck | One slot holds |
| --- | --- | --- |
| Dungeon Market | Dungeon (Rooms) | 1 Room card |
| Terrain Market | Terrain + Monsters | 1 Terrain card **paired with** 1 Monster card |
| Champion Market | Champions | 1 Champion card, bought at its printed price |
| Treasure Market | Treasures | 1 Treasure card, bought in the End Phase for its Coin cost once you reach its soul threshold |
| Objective Market | Objectives | 1 Objective card, **claimed** (not bought) by the first villain to complete it. See [Objectives](05-objectives-and-scoring.md) |

- **Rule (answers Q-20):** the Dungeon and Terrain markets have **players + 2** slots (4 at 2 players, 8 at 6). The Champion market always has **3**. The **Treasure market** also has **players + 2** (answers Q-34a), and so does the **Objective market** (answers Q-79a). The Objective market never drops its oldest card (answers Q-79b).
- **Assumed:** the Champion and Treasure markets follow the same shift, refill and oldest-discard rules. → Q-25, Q-34b
- **Rule (answers Q-24):** when a deck runs out, **shuffle its discards** into a new deck. The **Hero deck is the exception**: it never reshuffles. Once it's empty, no new Heroes arrive, and the game ends when the last Hero is defeated.
- **Rule (answers Q-23):** taking a Room or a Terrain + Monster pair, and building a Room, are **free**. Your one pick each round is the limit. Coins go on Champions, Champion pay, Treasures and Trick costs.

## Market rules (Dungeon Market, decided)

- **Rule:** the cards sit in a row, ordered by age: **left is the oldest, right is the newest**.
- **Rule (taking a card):** when a card is taken, every card to its right shifts one slot left to close the gap, and a new card from the deck fills the **right-most** slot.
- **Rule (new round):** at the start of each round, the **left-most** (oldest) card is discarded, the rest shift left, and a new card fills the right-most slot.
- **Rule (Town Phase):** each player gets **one** pick a round: a Room from the Dungeon Market, a Terrain + Monster pair from the Terrain Market, **or** a Champion. See [Round Flow](02-round-flow.md#2-town-phase).
- **Rule (blind draw):** in the opening draft, a player can take the top card of the deck instead of a market card. **Open:** whether blind draws are allowed during the Town Phase too. → Q-22

```
taking slot 2 (S = shift, N = new card):
[A][B][C][D][E]  →  [A][C][D][E][N]
start of round:
[A][B][C][D][E]  →  [B][C][D][E][N]   (A is discarded)
```

## Terrain Market specifics

- **Rule:** Terrain cards are always drafted **together with a Monster**. Both are random, so the two may not suit each other.
- **Rule:** Monsters can be moved to other squares later, so it's worth drafting for a better pairing down the line. See [Overworld](07-overworld.md).
- **Rule:** in the Town Phase, drafting a Terrain pair **uses your one pick**, so you can't also take a Room that round.
- **Open:** whether the Terrain Market discards its oldest card each round like the Dungeon Market. Assumed yes. → Q-21

## Open

