# 11 — Data Model (draft)

A first sketch of the entities, written as TypeScript-style types so it can be turned into code. Fields marked `// Q-xx` depend on an open question and will change.

The approach is **data-driven cards**: card definitions live in JSON files under [`data/`](../../data/README.md) and rules code reads them, so cards and Regions can be added without changing code. The placeholder core set is in `data/core/`.

Every card also has these shared fields (left out of the types below):

```ts
interface CardMeta { copies?: number /* default 1 */; flavour: string; art: string | null; todo: ("name" | "flavour" | "art" | "wording" | "balance")[] /* what's still placeholder */; }
```

```ts
// ---------- Card definitions (static data) ----------
type HeroClass = "Warrior" | "Mage" | "Acolyte" | "Rogue";
type HeroTier  = "Common" | "Paragon" | "Legendary";
type TrickType = "Spell" | "Construction" | "Deceit" | "Empower" | "Command"; // only Spell is decided
type Stat = "might" | "magic" | "faith" | "cunning";
interface HeroStats extends Record<Stat, number> { health: number; } // each stat = d6 in the pool
// Anything a Hero must beat: rolls `dice` d6 against the Hero's `tests` stat; most hits wins
// rank decides ties: hero wins a tie if tierRank(hero) >= rank (Common/Monster 1, Paragon/Champion 2, Legendary/Villain 3)
type ThreatRank = "Monster" | "Champion" | "Villain"; // Monster = overworld monsters, creature rooms and traps; a Champion lifts its room to Champion
interface Threat { tests: Stat /* Q-17g */; dice: number; damage: number; rank: ThreatRank; }

interface VillainCard  { id: string; name: string; power: Effect[]; threat: Threat; health: number /* damage persists; healing costs souls, Q-14 */; }
interface RoomCard     { id: string; name: string; trap?: boolean /* tests Cunning */; threat?: Threat /* printed; some Rooms have only an effect */; effect: Effect[] /* active when on top */; treasure?: { type: TreasureType; value: number; when: "upkeep" | "whileOnTop" }; minionBonus?: Effect[]; coveredBonus: Effect[] /* passive while buried; stacks unlimited, destroyed Rooms discarded */; soulExchanges?: { souls: number; gives: Effect }[] /* End Phase, Q-35a */; } // taking and building are free (Q-23)
interface ItemCard     { id: string; name: string; type: HeroClass; heroEffect: Effect[]; villainEffect: Effect[]; recharges: boolean; }
interface ChampionCard { id: string; name: string; cost: number /* printed, ~2-5 */; dice: number /* room uses max(room, champion) at Champion rank */; roomBonus: Effect[]; levels: { coins: number; effect: Effect[] }[] /* printed per card, usually 2-3 */; }
type Phase = "upkeep" | "town" | "build" | "lure" | "adventure" | "end";
interface TrickCard    { id: string; name: string; type: TrickType; effect: Effect[]; recharge?: 1 | 2 | 3 /* Spells only */; playCost: { coins?: number; souls?: number } /* empty = free; Mage overflow adds coins */; phases: Phase[] /* printed; no reactions */; }
interface HeroCard     { id: string; name: string; class: HeroClass; tier: HeroTier; stats: HeroStats; desire: number /* own-class treasure + floor(gold/3) */; souls: 1 | 2 | 3 /* by tier */; }
type Status = "Cursed" | "Slowed" | "Bleeding"; // starter set; timers tick in End Phase
interface TerrainCard  { id: string; name: string; terrainType: string; kind: "hazard" | "status"; threat?: Threat /* hazard, Monster rank */; status?: Status; statusRounds?: number /* printed duration */; }
interface MonsterCard  { id: string; name: string; preferredTerrain: string; threat: Threat; preferredBonus: Effect[]; }
interface ObjectiveCard{ id: string; text: string; kind: "event" | "state" /* event: scored when it happens; state: checked at game end */; trigger: TriggerCondition; }

interface Region {
  id: string; name: string;
  decks: { rooms: string[]; champions: string[]; tricks: string[]; heroes: string[]; items: string[]; terrain: string[]; monsters: string[]; villains: string[]; treasures: string[]; objectives: string[]; };
  town: { overflow: Record<HeroClass, Effect> /* per overflowing Hero */; capacity: number /* 2 */ };
}

// ---------- Game state (changes as you play) ----------
interface Market<T> { deck: T[]; slots: T[]; discard: T[]; size: number /* dungeon & terrain: players + 2; champions: 3 */; }
// Terrain market slot = { terrain: TerrainCard; monster: MonsterCard }

interface OverworldSquare { terrain?: TerrainCard; monster?: MonsterCard; }
type Overworld = OverworldSquare[][]; // 4x4, [row][col], (0,0) = entry

interface HeroInPlay {
  card: HeroCard;
  location:
    | { at: "town"; tempts: Record<PlayerId, number> /* per dungeon; lured at 1/2/3 by tier */ }
    | { at: "overworld"; owner: PlayerId; row: number; col: number }
    | { at: "dungeon"; owner: PlayerId; roomIndex: number }
    | { at: "villainFight"; owner: PlayerId };
  health: number;                  // starts at card.stats.health; dies at 0 (assumed)
  statuses: { status: Status; roundsLeft: number }[]; // timed; the same status adds to roundsLeft
  carrying?: ItemCard;             // Paragon/Legendary arrive with 1, Common with none
}

// A dungeon space holds a stack of rooms. The last one is the top (its effect is active);
// the ones below give their coveredBonus, so taller stacks get stronger.
interface DungeonSpace { stack: RoomCard[]; champion?: { card: ChampionCard; level: number } /* belongs to the space; guards the top Room. Empty stack: Q-49c */; }

interface TaintedItem { card: ItemCard; exhausted: boolean; } // villain effect recharges in Upkeep

interface PlayerState {
  id: PlayerId;
  villains: { card: VillainCard; damage: number; vanquished: boolean }[]; // 3 after the draft
  activeVillain: number;            // index; reserves are face-down until they step in
  hand: { rooms: RoomCard[]; tricks: TrickCard[] };   // limit 7 combined, checked at end of End Phase; the 5 opening rooms start here
  exhaustedSpells: { card: TrickCard; refreshIn: number }[]; // starts at the card's recharge, -1 each Upkeep
  dungeon: DungeonSpace[];          // exactly 5, in order from the entrance
  minions: { location: "unassigned" | "town" | { space: number }; townTarget?: HeroId /* re-chosen each Lure Phase */ }[]; // identical tokens, max 5, never lost; stay put until re-ordered
  overworld: Overworld;
  coins: number;                    // separate from treasure (Q-30 answered)
  treasury: (Treasure | ItemCard)[]; // lures heroes; stored items lure their own class
  sustainedItems: TaintedItem[];    // max 2

  souls: number;                    // spent only through Rooms' soulExchanges in the End Phase
  soulsHarvestedTotal: number;      // never goes down; unlocks TreasureCards and is the tie-break
  objectives: { card: ObjectiveCard; revealed: boolean; learnedBy: PlayerId[]; scoredBy?: PlayerId }[]; // 5 dealt, 1 revealed at start
  eliminated: boolean;
}

interface GameState {
  region: Region;
  round: number;
  firstPlayer: number;              // Town picks go clockwise from here; moves left each round. Build is simultaneous
  phase: Phase | "setup" | "gameOver";
  players: PlayerState[];
  dungeonMarket: Market<RoomCard>;
  terrainMarket: Market<{ terrain: TerrainCard; monster: MonsterCard }>;
  championMarket: Market<ChampionCard>;
  treasureMarket: Market<TreasureCard>;  // players + 2, bought in End Phase
  heroDeck: HeroCard[];
  heroes: HeroInPlay[];
  itemDeck: ItemCard[];
  townShop: ItemCard[];              // items no hero was eligible for; first eligible hero takes one (Q-36d)
  rng: Seed;                         // seeded so hero movement and draws can be replayed
}

// Draft effect shape: `op` for the engine, `text` as the source of truth. Vocabulary in data/README.md
type Effect = { op: string; text: string; when?: "passive" | "upkeep" | "end" | "onEnter" | "afterWin" | "whileOnTop"; recharges?: boolean; target?: string; amount?: number; [arg: string]: unknown };
type TriggerCondition = { op: string; [arg: string]: unknown }; // objective triggers, e.g. heroKilled { tier }
type TreasureType = HeroClass | "Gold"; // Gold lures every class at 1/3 value, rounded down
type Treasure = { type: TreasureType; value: number };
interface TreasureCard { id: string; name: string; type: TreasureType; value: number; soulThreshold: number /* soulsHarvestedTotal needed */; coinCost: number; } // from the Treasure Market
```

## Implementation notes

- **Seeded RNG:** hero movement, shuffles, pairings, lure rolls and combat dice all depend on randomness. A seeded RNG makes games replayable and testable.
- **Hidden information:** objective lists and reserve villains are secret, so the rules engine has to give each player their own view of the state.
- **The rules engine stays separate from the UI**, so the same rules can run in tests, local hotseat play or a future online mode.
