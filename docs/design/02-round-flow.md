# 02 — Round Flow

**Rule:** every round runs these six phases in this order (answers Q-04).

```
1 Upkeep → 2 Town → 3 Build → 4 Lure → 5 Adventure → 6 End
```

## 1. Upkeep

- **Rule:** each Villain gains **1 Coin**.
- **Rule:** Tainted Items, Spells and abilities recharge. See [Items](12-items.md).
- **Rule:** Rooms that produce **Minions** (e.g. a Barracks) give them now. See [Minions](13-minions.md).
- **Rule:** Rooms that produce **treasure** (e.g. a Vault) add it to your treasury now. See [Dungeon](06-dungeon-and-champions.md).
- **Rule (from Markets):** each market discards its oldest (left-most) card and adds a new one on the right. See [Markets](03-markets.md).
- **Rule (answers Q-61):** each Spell has a **printed recharge time** (1, 2 or 3 Upkeeps), and stronger Spells take longer. Each Upkeep ticks every exhausted Spell's timer down by 1, and it's ready again at 0.

## 2. Town Phase

- **Rule:** reveal **1 Hero** from the Hero deck. It arrives in the Town.
- **Rule:** a revealed **Paragon** or **Legendary** Hero gets **1 Item**. If the Item drawn doesn't suit them, it goes to the **Town Shop** and waits for the first eligible Hero. See [Items](12-items.md).
- **Rule:** each player makes **one** of these choices:
  - take a **Room** from the Dungeon Market, **or**
  - **buy a Champion**, **or**
  - draft a **Terrain + Monster pair** from the Terrain Market. **Rule (answers Q-05a):** place it **at once**, for free, on any wasteland square of your Overworld.
- **Rule (answers Q-06):** players make their Town picks **in turn, clockwise**. The **first player moves one seat left** each round.
- **Rule (answers Q-46):** Champions are bought from a face-up **Champion market** of 3, at each card's **printed price** (about 2 to 5 Coins).

## 3. Build Phase

**Rule (answers Q-06):** all players build **at the same time**.

Each player can:

- **Place a Room** in their dungeon, either in an empty space or **on top of an existing room** (rooms stack).
- **Place a Champion** in a room. A Champion occupies the room without replacing it.
- **Move a Champion** to another space with no Champion (once per Build Phase).
- **Advance Champions** by paying them, if you want to. See [Champions](06-dungeon-and-champions.md).
- **Destroy the top Room** of a stack, if you want to.
- **Play Build-phase Tricks.** Tricks can be limited to certain phases. See [Tricks](09-tricks.md).
- **Move one Monster** to another Terrain square, or **swap two**: once per Build Phase, for free. See [Overworld](07-overworld.md).
- **Give orders to Minions:** one order per Minion, e.g. stay in a Room or go to the Town. See [Minions](13-minions.md).

- **Rule (answers Q-05):** each player makes **1 placement** per Build Phase: **1 Room or 1 Champion**. Everything else (advancing Champions, destroying a top Room, Tricks, Minion orders) is **extra**, limited only by cost.
- **Rule (answers Q-07):** everyone **builds simultaneously and reveals**. Then Tricks are played **one at a time in turn order**, starting with the first player.
- **Note:** Terrain isn't placed here. It's placed in the Town Phase as soon as it's drafted.

## 4. Lure Phase

- **Rule:** each Hero in the Town compares their **desire** with each dungeon's **treasure count**. If the matching treasure **meets or beats** their desire, the Hero is tempted **automatically**. If it's short, a **die is rolled**.
- **Rule:** a success **tempts** the Hero. Each dungeon keeps **its own** tempt count. Once one dungeon has tempted a Hero **1 / 2 / 3 times** (Common / Paragon / Legendary), the Hero is **lured** to it and goes to the top-left square of that villain's Overworld.
- **Rule:** each of your Minions in the Town gives **+1 tempt** on one Hero of your choice.
- Details are in [Heroes & Town](08-heroes-and-town.md#luring). Every Hero checks every dungeon each round (answers Q-51a).

## 5. Adventure Phase

- **Rule:** Heroes move in order of **how close they are to the Villain**, closest first:
  1. Heroes fighting the Villain, or in the dungeon's deeper rooms
  2. then Heroes in earlier rooms
  3. then Heroes at the dungeon entrance
  4. then Heroes in the Overworld
- **Rule:** fights are decided with a **dice pool**. See [Combat](#combat-dice-pool) below.
- **Rule:** when a Hero carrying an Item is defeated, the Item becomes Tainted. See [Items](12-items.md).
- **Derived:** Heroes move **one room per round** in the dungeon (answers Q-44).
- **Rule (answers Q-40a):** an **empty** dungeon space still takes the Hero **one round** to cross, but nothing happens there. Empty dungeons buy you time, not safety.
- **Rule (answers Q-86):** each player's lands resolve **at the same time**. Order only matters among the Heroes in **one player's** Overworld and dungeon.
- **Open:** in one player's lands, what order for two Heroes at the same distance (e.g. on the same Overworld square)? The owner chooses? → Q-86a
- **Note for code:** a Trick or effect can reach into another player's lands mid-Adventure, which breaks "simultaneous". Resolve those in turn order (as in the Build Phase), or keep Tricks out of the Adventure Phase. → Q-86a

### Combat: dice pool

- **Rule:** roll a number of **d6 equal to your stat**. Each **5 or 6 is a hit**.
- **Rule (stats):** Heroes have **four combat stats**: **Might, Magic, Faith, Cunning**. They also have **Health**.
- **Rule:** each threat (a Room, Monster or Villain) says **which stat it tests**. The Hero rolls that stat, and the threat rolls its own dice.
- **Rule (one exchange):** each side rolls once and the hits are compared, and **most hits wins**:
  - **Threat wins:** the Hero takes the threat's **printed damage** to Health.
  - **Hero wins:** the Hero gets past **unharmed**.
- **Assumed:** a Hero dies at 0 Health. Their soul is harvested, and any Item they carried becomes Tainted.
- **Assumed:** the classes lean on these stats: Warrior → Might, Mage → Magic, Acolyte → Faith, Rogue → Cunning. → Q-17e
- **Rule (ties, answers Q-17d):** ties depend on the Hero's **tier** against the threat's **rank** (Monster < Champion < Villain):

  | Hero tier | Tie vs Monster | Tie vs Champion | Tie vs Villain |
  | --- | --- | --- | --- |
  | Common | Hero wins | Threat wins | Threat wins |
  | Paragon | Hero wins | Hero wins | Threat wins |
  | Legendary | Hero wins | Hero wins | Hero wins |

  In code: **the Hero wins a tie if tier rank ≥ threat rank** (Common/Monster = 1, Paragon/Champion = 2, Legendary/Villain = 3).
- **Rule:** **Monster rank** covers Overworld Monsters and Rooms with creatures in them. (This isn't the same as **Minions**, who never fight. See [Minions](13-minions.md).)
- **Rule (answers Q-17h):** a Room with a **Champion** in it fights at **Champion rank**, rolling the Champion's dice if they're higher than the Room's.
- **Rule:** **trap Rooms** (no creatures) are Monster rank and **test Cunning**, so Rogues handle them best.
- **Rule (Villain fight, answers Q-17f):** a **fight to the death**. The Hero and the Villain trade one exchange **each round** until one of them is beaten.
  - Villain wins an exchange: the Hero takes the Villain's damage.
  - Hero wins an exchange: the Villain takes **tier damage** (Common 1, Paragon 2, Legendary 3) **plus 1 for every hit** the Hero rolled above the Villain. A win on a tie is tier damage only.
  - **Rule:** Villains have printed **Health**. Healing is **very limited and costs a lot of souls**. → Q-14 for the exact costs
  - The Villain beaten: **vanquished**. The Hero **returns to the Town**, heals and loses their statuses, and can be lured again (see [Heroes](08-heroes-and-town.md)). The Hero beaten: dies, and the soul is harvested.
- **Open:** whether a threat can test more than one stat, or let the Hero choose. → Q-17g

```
hits(n) = count of n d6 showing 5 or 6
heroHits   = hits(hero.stats[threat.tests])
threatHits = hits(threat.dice)
heroWins = heroHits > threatHits
        or (heroHits == threatHits and tierRank(hero) >= rank(threat))
if heroWins:
    if threat is Villain: villain.health -= tierDamage(hero) + (heroHits - threatHits)
    else: hero passes
else: hero.health -= threat.damage
```

## 6. End Phase

- **Rule:** status timers tick down by 1. See [Overworld](07-overworld.md).
- **Rule:** for each Hero who died in your lands this round, gain **Coins by tier**: Common 1, Paragon 2, Legendary 3, minus 1 for each Rogue overflowing in the Town. (Timing assumed: End Phase. It could be the moment they die. → Q-33b)
- **Rule (answers Q-35):** villains can **exchange souls** for Tricks, Villain healing, Room and Champion upgrades, and Minions, but **only through Rooms that allow it**. Such a Room reads "While this Room is in your dungeon, you can exchange X souls for Y." With no such Room, souls can't be spent this way. See [Dungeon](06-dungeon-and-champions.md).
- **Open:** does a covered Room's exchange still work? Can each exchange be used more than once per End Phase? → Q-35a
- **Rule:** the **total souls you've ever harvested** unlocks which **Treasures** you can make. Harvesting souls only crosses thresholds; souls are **not** spent to make treasure.
- **Rule (answers Q-62):** each player discards down to **7 cards** in hand (Rooms and Tricks together).
- **Rule (from Overview):** check whether the game is over. It ends when no Heroes are left in the region.
- **Rule:** Each **Treasure card** prints its own **soul threshold** (total souls harvested needed) and **Coin cost** (answers Q-34).
- **Rule:** Treasure cards come from the **Treasure Market** (players + 2 slots). In the **End Phase** you can buy a Treasure card from it once your total souls harvested reaches its threshold, paying its Coin cost (answers Q-34a).
- **Open:** how many Treasures can you buy each End Phase? Does the Treasure market follow the same discard rules? → Q-34b
