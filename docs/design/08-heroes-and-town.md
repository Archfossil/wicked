# 08 — Heroes & Town

Heroes are mercenaries with better PR. They've heard rumours that the villains are back. They're right, but still, the audacity.

## Hero lifecycle

1. **In Town:** each Town Phase, **1 Hero** is revealed from the Hero deck and joins the shared Town. Paragon and Legendary Heroes arrive **carrying 1 Item** (see [Items](12-items.md)).
2. **Lured:** in the Lure Phase, Heroes are tempted by the treasure in a dungeon's treasury. Once tempted enough times, the Hero heads for that villain. See [Luring](#luring).
3. **Overworld:** the Hero crosses that villain's 4×4 grid (see [Overworld](07-overworld.md)).
4. **Dungeon:** the Hero goes through the rooms (see [Dungeon](06-dungeon-and-champions.md)).
5. **Villain fight:** the Hero fights the active Villain (see [Villains](04-villains.md)).
6. **Result:** if the Hero dies at any step, its **soul** is harvested and its **loot** gives Coins by tier (1 / 2 / 3). Both go to the villain whose **Overworld or dungeon** killed them, or to the player whose **Trick** did (answers Q-55; same rule as Tainted Items). If the Hero wins, the villain is **vanquished**.
7. **Back to Town (answers Q-54):** a Hero who vanquishes a Villain **returns to the Town**, where they can be **lured again**. They **heal to full** and **lose all statuses**.
   - **Tempts reset (answers Q-54c):** their tempt counts go back to **0**, and they take a building slot or overflow like any other Hero.
   - **Stolen Items (answers Q-54b):** the Hero steals one of the Villain's **sustained** Tainted Items: one of **their own class** if there is one, otherwise one **at random**. If none are sustained, nothing is stolen (assumed). They keep it only if they're eligible for it (their class, and not already carrying one). Otherwise it goes to the **Town Shop**. → Q-54d

### Open

- Q-54d: does a stolen Item stop being Tainted and get its Hero effect back (assumed yes)? Can a Common Hero keep one (assumed no: normal eligibility applies, so it goes to the Shop)? Is an Item stolen every time a Villain is vanquished?

## Luring

- **Rule:** each Hero has a **desire**: how much treasure it takes to interest them, and **which treasure types** they want. The class sets the type (answers Q-51).
- **Rule:** in the Lure Phase, a Hero's desire is compared with a dungeon's **treasure count**.
- **Rule:** if the treasure **meets or beats** the desire, the Hero is **tempted automatically**. If it falls short, a **die is rolled** for a chance to tempt them anyway.
- **Rule:** after **enough tempts**, the Hero is **lured** and goes to the top-left square of that villain's Overworld.
- **Rule:** Tainted Items kept in a treasury lure Heroes of the **matching class**. See [Items](12-items.md).
- **Rule:** each **Minion** you send to the Town gives your dungeon **+1 tempt** on one Hero of your choice each round it stays there. You **choose the target each Lure Phase** (answers Q-18g). See [Minions](13-minions.md).

```
for each Hero in Town:
  for each dungeon:                         # every dungeon, every round (Q-51a)
    t = treasure of hero's class + floor(gold / 3)   # other classes' treasure doesn't count (assumed, Q-32b)
    if t >= hero.desire: tempted
    else: roll t d6 → tempted if any 5-6    # Q-51b: same dice pool as combat; t = 0 means no chance
    on tempted: hero.tempts[dungeon] += 1   # each dungeon keeps its own count
    hero.tempts[dungeon] += minionsInTownTargeting(hero, dungeon)   # +1 each
    if hero.tempts[dungeon] >= LURE[hero.tier]: hero is lured by that dungeon
# LURE = { Common: 1, Paragon: 2, Legendary: 3 }
# dungeons are checked in turn order from the first player; the first to reach LURE gets the Hero (Q-52)
```

- **Rule (answers Q-51a):** every Hero in Town checks **every dungeon** each round.
- **Rule (answers Q-51b):** when treasure is short, roll **1 d6 per point of treasure** the dungeon has for that Hero (class treasure + Gold/3). **Any 5 or 6** tempts them. With no treasure for them, there's no roll.
- **Rule (answers Q-51c):** tempts are counted **per dungeon**. Each dungeon builds its own count on each Hero.
- **Rule (answers Q-51d):** a Hero is lured once one dungeon has tempted them **1 time (Common), 2 times (Paragon) or 3 times (Legendary)**. The **first** dungeon to get there gets the Hero.
- **Rule (answers Q-52):** if two dungeons would lure the same Hero in one round, dungeons are checked in **turn order from the first player**, and the first one to reach the count gets them.
- **Rule (answers Q-53):** luring **doesn't spend** treasure. It only has to be there; the treasury keeps it.

## Classes

- **Rule:** the four classes are **Warrior, Mage, Acolyte, Rogue**.
- **Rule (answers Q-56):** each class is strong in its **main stat**, is lured by **its own treasure type**, and has a **class passive**:

| Class | Main stat | Lured by | Passive |
| --- | --- | --- | --- |
| Warrior | Might | Warrior treasure | **+1 Health** |
| Mage | Magic | Mage treasure | **Ignores 1 status** |
| Acolyte | Faith | Acolyte treasure | **Heals 1 after each win** (each exchange won) |
| Rogue | Cunning | Rogue treasure | **May skip one trap Room** |

- **Open:** "ignores 1 status": the first one they get, or one of their choice? Is Rogue's skip once per dungeon run? Is Acolyte healing capped at max Health (assumed yes)? → Q-56a

## Tiers

- **Rule:** the tiers are **Common Hero → Paragon Hero → Legendary Hero**.
- **Rule:** Paragon and Legendary Heroes arrive carrying 1 Item (or pick one up from the Town Shop), and Common Heroes carry none.
- **Rule:** tier decides who wins **tied** combat rolls. Common Heroes win ties only against Monsters, Paragons also win them against Champions, and Legendaries win every tie.
- **Rule:** when a Hero beats the Villain in an exchange, they deal tier damage (Common 1, Paragon 2, Legendary 3) plus 1 for each extra hit. See [Combat](02-round-flow.md#combat-dice-pool).
- **Rule (answers Q-57):** higher tiers have **bigger stat pools and more Health**, and give **more souls** when harvested: **Common 1, Paragon 2, Legendary 3**. Heroes **never move up** a tier.

## The Town

- **Rule:** each Region has its own Town.
- **Rule:** the Town has **one building per hero class** (4 buildings).
- **Rule:** the Town also has a **Shop** that holds Items no Hero was eligible for. See [Items](12-items.md).
- **Rule (answers Q-59):** each building holds **2 Heroes** of its class. Each Hero beyond that in the Town is **overflow**, and overflow effects **scale**: they apply **once per overflowing Hero**.

| Building | Overflow effect (per extra Hero) |
| --- | --- |
| Warrior | **Monsters deal 1 less damage** (answers Q-59a; minimum 0, assumed) |
| Rogue | **Hero loot gives 1 fewer Coin** (answers Q-59a; minimum 0, assumed) |
| Mage | **+1 Coin** for every villain each time they play a Trick (answers Q-58) |
| Acolyte | **Heroes heal 1** each round (answers Q-58). Which Heroes (all of them, or only those out adventuring)? → Q-59b |

- **Open:** does Warrior overflow also weaken Rooms with creatures in them (Monster rank), or only Overworld Monsters? → Q-59b

## Treasure

- **Rule:** Treasure is separate from Coins (answers Q-30).
- **Rule (answers Q-32):** there are **five treasure types**:
  - **Warrior, Mage, Acolyte, Rogue:** each lures its own class at full value. Stored Items count as their class type.
  - **Gold:** lures **every** class at **one third** value, rounded down (3 Gold counts as 1).
- **Rule:** the Treasures you can make are unlocked by your **total souls harvested** crossing thresholds. Souls are not spent to make them. Each **Treasure card** prints its own **soul threshold** (total souls harvested needed) and **Coin cost** (answers Q-34). They're bought from the **Treasure Market** in the End Phase (answers Q-34a). See [Markets](03-markets.md).

## Hero fields (draft)

| Field | Notes |
| --- | --- |
| Name | |
| Class | Warrior / Mage / Acolyte / Rogue |
| Tier | Common / Paragon / Legendary |
| Stats | **Might, Magic, Faith, Cunning**: the number of d6 rolled when a threat tests that stat |
| Health | The Hero dies at 0 (assumed). Warriors +1. Healed to full on returning to Town |
| Carried Item | Paragon and Legendary only, 1 each. Buffs the Hero, and becomes Tainted when the Hero falls |
| Desire | Amount + wanted treasure types (from class). Met: auto-tempt; short: roll 1 d6 per treasure point |
| Tempts | One counter per dungeon while in Town. Lured at 1 / 2 / 3 by tier |
| Souls | 1 / 2 / 3 by tier. Spent through Rooms with a soul exchange |
