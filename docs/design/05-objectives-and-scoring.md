# 05 — Objectives & Scoring

## The idea

Villainy is less about what you achieve and more about what you take from others. So objectives aren't "do this thing" but "**stop another villain from doing this thing**."

## Rules (decided)

- **Rule:** each player has a **secret objective list**.
- **Rule (answers Q-70):** at setup each player is dealt **5 objectives** from an Objective deck.
- **Rule (answers Q-71):** the lists are mostly secret, with ways to leak:
  - At the start, each player **chooses 1** of their objectives and reveals it to everyone (answers Q-77).
  - **Minions and Tricks** can **learn** other players' objectives, **force swaps**, or have objectives **replaced**.
  - Each time one of your Villains is **vanquished** and a new Villain takes over, you **reveal another objective at random**.
- **Rule:** the objectives on *your* list are things you want to stop the *other* villains from doing. When another villain does one, they **score** it against you.
- **Rule:** at game end (the last Hero defeated), the **surviving** player with the most **unscored** objectives on their list wins and becomes the **Overlord**.
- **Rule (answers Q-72):** each objective card **prints how it's checked**:
  - **Event** (e.g. "a villain kills a Legendary Hero"): scored **the moment it happens**, and it stays scored.
  - **State** (e.g. "a villain has 5 Rooms"): checked **at game end** against the final board.
- **Rule (answers Q-74):** one action can score objectives on **several lists at once**. Every matching objective is scored.
- **Rule (answers Q-73):** a scored objective is **revealed to everyone**.
- **Rule:** tie-break: **most souls harvested** (total).
- **Rule:** eliminated players can't win.
- **Rule (answers Q-02):** the **Heroes win** only if **every** villain is eliminated.

## Example objective (illustration only)

> *"No other villain may build a Frozen room."* If anyone else does, this objective is scored and you lose it.

## Objective state (for code)

Each objective on a list is:

- `hidden` or `revealed` (to everyone), plus a list of individual players who have **learned** it privately
- `unscored` or `scored by <player>`
- `kind`: `event` (scored when it happens) or `state` (checked at game end)

## Open

- Q-75: if the tie-break is also tied (same souls), what then?
- Q-76: "force swaps": does that swap an objective between two players' lists, or swap one of yours for a new card from the deck? Does a swapped or replaced objective keep its scored or revealed status?
