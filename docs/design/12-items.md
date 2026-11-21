# 12 — Items

Items are a deck of powerful relics. They start out helping the Heroes, but once those Heroes fall they become **Tainted** and the villains use them.

## Rules (decided)

- **Rule:** Items are their own **deck**. They come into the Town **with Heroes**: every **Paragon** and **Legendary** Hero arrives **carrying 1 Item**. **Common** Heroes carry none (answers Q-36).
- **Derived:** a Hero carries at most 1 Item.
- **Rule (Town Shop):** if an Item turns up with **no eligible Hero** to attach to, it sits in the **Town Shop**. It attaches to the **very first eligible Hero** who arrives.
- **Rule (eligibility):** a Hero is eligible for an Item if they're **Paragon or Legendary**, **match the Item's class type**, and **don't already carry one**.
- **Rule (arrival):** when a Paragon or Legendary Hero arrives:
  1. If the Shop has an Item they're eligible for, they take it.
  2. Otherwise, draw the top Item card. If they're eligible for it, they carry it. If not, it goes to the Shop and the Hero arrives **empty-handed** (there's no redraw).
- **Open:** if the Shop has several eligible Items, which one does the Hero take (the oldest?), and is there a Shop limit? → Q-36d
- **Rule:** every Item has **two effects**:
  1. **Hero effect:** buffs a Hero who brings the Item to a dungeon, making them harder to stop.
  2. **Villain effect:** usable once the Item is **Tainted**.
- **Rule:** when a Hero carrying an Item is defeated, the Item becomes **Tainted** and a Villain can use it.
- **Rule (answers Q-37):** the Tainted Item goes to the villain whose **Overworld or dungeon killed the Hero**. If another villain's **Trick** killed them, it goes to **that Trick's player**.
- **Rule:** a Villain can **sustain at most 2 Tainted Items** at a time.
- **Rule (answers Q-39):** whenever you gain a Tainted Item, **choose which 2 you sustain**. The rest go to your **treasury** (as lures) or to **another player**. You can also **swap** which ones you sustain in each **Build Phase**.
- **Rule:** some Villain effects need to **recharge**. They recharge in **Upkeep**.
- **Rule:** each Item has a **type**: Warrior, Mage, Acolyte or Rogue.
- **Rule:** spare Tainted Items (beyond the 2 you sustain) can be:
  - **given to another player**, or
  - **kept in your treasury**, where they **lure Heroes of the matching class**.

- **Rule:** a Hero who vanquishes a Villain can **steal an Item**. It's a **sustained** Item of their class if there is one, otherwise a random sustained one (answers Q-54b). They keep it if they're eligible. Otherwise it goes to the **Town Shop**. → Q-54d

## Item lifecycle

```
Item deck ──(drawn for arriving Paragon/Legendary Hero)──► eligible? ──no──► Town Shop ──(first eligible Hero)──┐
                                                               │yes                                        │
                                                               ▼                                           ▼
                                                        Hero carries it ◄──────────────────────────────────┘
                                                               │
                                                     Town ──► Overworld / Dungeon ──Hero defeated──► Tainted
                                                                                    │
                     ┌──────────────────────────────────────────────────────────────┤
                     ▼                          ▼                                   ▼
             Sustained (max 2)          Given to another player          Kept in treasury
             villain effect usable                                       lures matching class
```

## Item fields (draft)

| Field | Notes |
| --- | --- |
| Name, flavour | |
| Type | Warrior / Mage / Acolyte / Rogue |
| Hero effect | Buff while a Hero carries it |
| Villain (Tainted) effect | Usable while sustained |
| Recharges? | Whether the villain effect exhausts and recharges in Upkeep |
| Lure value | How much it counts as treasure of its class type when stored |

## Open

- Q-36d: if the Shop has several eligible Items, which one does the Hero take? Is there a Shop limit?
- Q-38: when can you give an Item to another player, does it cost anything, and can they refuse?
- Q-39a: do Items in the treasury do anything besides luring? Can a swapped-out Item come back from the treasury in a later Build Phase (assumed yes)?
