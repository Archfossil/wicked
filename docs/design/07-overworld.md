# 07 — Overworld

Before Heroes can reach your dungeon, they cross *your* Overworld: a land that bends to your will as your power grows.

## The grid

- **Rule:** each player has their own **4×4 grid**.
- **Rule:** it starts as an empty **wasteland**, with no features and no monsters.
- **Rule:** Terrain cards drafted from the [Terrain Market](03-markets.md) fill squares in the grid. A drafted pair is placed **straight away**, for free, on **any wasteland square**.
- **Idea:** later versions may try other board shapes or borders.

Coordinates for code: `(row, col)` with `(0,0)` top-left and `(3,3)` bottom-right.

```
(0,0) → → → (0,3)
  ↓           ↓
(3,0) → → → (3,3) → Dungeon entrance
```

## Hero movement

- **Rule:** a lured Hero **enters at the top-left square** `(0,0)`.
- **Rule:** each round, in the Adventure Phase, the Hero moves **1 square, either right or down, at random**. Overworld Heroes move **after** every Hero in the dungeon (closest to the Villain moves first). See [Round Flow](02-round-flow.md#5-adventure-phase).
- **Rule:** once the Hero is on the bottom-right square `(3,3)`, its next move takes it to the **dungeon entrance**.
- **Derived:** every path is 6 moves inside the grid plus 1 into the dungeon. A Hero touches 7 squares (including `(0,0)`) and reaches the dungeon on the 7th move.
- **Assumed:** on the right edge the Hero can only move down, and on the bottom edge only right. → Q-80 to confirm.
- **Rule (answers Q-81):** a Hero triggers every square it **enters**, including the start square `(0,0)` on the round it's lured. That's **7 encounters** per crossing. A bare wasteland square does nothing.
- **Rule (answers Q-82):** several Heroes can be on the same square, but each one **resolves separately** against what's there.
- **Rule (answers Q-88):** on a square with both, the **Terrain resolves first** (Hazard roll or Status), and **then the Monster** fights, whatever the Terrain's result. Losing to a Terrain hurts, but the Hero still faces the Monster unless they're dead.

## Terrain

- Terrain makes the trip more dangerous, e.g. hex-filled swamps, cloud fortresses, vampiric strongholds.
- **Rule:** each Terrain square can hold a **Monster**.
- **Open:** can Terrain be replaced or built over once placed? → Q-83
- **Rule (answers Q-84):** each Terrain is one of two kinds:
  - **Hazard:** a threat at **Monster rank**. It tests a stat with its own dice and deals its damage if it wins, just like a Room.
  - **Status:** inflicts a **lasting condition** on the Hero (e.g. Cursed, Slowed, Weakened) that hurts them later, often in your dungeon.
- **Rule (answers Q-87):** statuses are **timed**. Each lasts a **printed number of rounds**. Getting the same status again **adds to its timer**.
- **Rule (answers Q-87a):** the three starter statuses are below. Timers **tick down by 1 in the End Phase**.

  | Status | Effect |
  | --- | --- |
  | **Cursed** | -1 die on every roll |
  | **Slowed** | Spends 2 rounds in each dungeon Room (and each empty space, assumed) |
  | **Bleeding** | -1 Health each round |

- **Rule:** a Hero who returns to Town **loses all statuses**. Mages ignore 1 status.
- **Open:** can one Terrain be both a Hazard and a Status? Does Slowed also slow movement in the Overworld? → Q-87b

### Terrain fields (draft)

| Field | Notes |
| --- | --- |
| Name, terrain type | The type matters for Monster preferences |
| Kind | Hazard or Status |
| Hazard threat | Hazard only: tested stat, dice, damage (Monster rank) |
| Status inflicted | Status only: which condition, and for how many rounds |
| Region theme | |

## Monsters

- **Rule:** Monsters are drafted **paired with a Terrain** card. The pair is random.
- **Rule:** each Monster has a **preferred terrain type** where it works best.
- **Rule:** Monsters can be **moved** to another Terrain square after you have them.
- **Rule (answers Q-85):** **once each Build Phase**, for free, you can **move one Monster** to another Terrain square, or **swap two Monsters**.
- **Assumed:** a Monster can only sit on a Terrain square (not bare wasteland), one per square.
- **Rule:** each Warrior overflowing in the Town makes Monsters deal **1 less damage** (see [Heroes & Town](08-heroes-and-town.md)).

### Monster fields (draft)

| Field | Notes |
| --- | --- |
| Name | |
| Preferred terrain type | |
| Threat | Tested stat, dice, damage (Monster rank) |
| Bonus on preferred terrain | |
