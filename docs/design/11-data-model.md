# 11 — Data Model (draft)

The entities, written as TypeScript-style types. The card definitions are still a draft. The **game state** section matches the prototype engine in `src/engine/` (plain JavaScript), so change both together. Fields marked `// Q-xx` depend on an open question and will change.

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
interface MonsterCard  { id: string; name: string; preferredTerrain: string; threat: Threat; preferredBonus: Effect[] /* addDice or addDamage, applied on its preferred terrain */; }
interface ObjectiveCard{ id: string; name: string; text: string; kind: "event" | "state" /* event: claimed when it happens; state: checked at the end of each End Phase */; trigger: TriggerCondition; reward: Effect[] /* gainCoins, gainSouls, gainTrick, gainMinion */; }

interface Region {
  id: string; name: string;
  decks: { rooms: string[]; champions: string[]; tricks: string[]; heroes: string[]; items: string[]; terrain: string[]; monsters: string[]; villains: string[]; treasures: string[]; objectives: string[]; };
  town: { overflow: Record<HeroClass, Effect> /* per overflowing Hero */; capacity: number /* 2 */ };
}

// ---------- Game state (changes as you play) ----------
// This section matches the code in src/engine/ (game.js creates it). Keep them in step.
// A card in play is an instance { uid, id }: `id` is the card definition, `uid` tells copies apart.
// The loader adds `deck` ("rooms", "items", ...) to each definition so code can tell card types apart.
interface Card { uid: string; id: string; }

interface Market { type: "dungeon" | "terrain" | "champion" | "treasure" | "objective"; size: number /* dungeon, terrain, treasure, objective: players + 2; champion: 3 */;
  deck: Card[]; discard: Card[]; slots: Card[] /* index 0 = oldest (left) */;
  monsterDeck?: Card[]; monsterDiscard?: Card[]; } // terrain only: slots hold { terrain: Card; monster: Card }

interface OverworldSquare { terrain: Card | null; monster: Card | null; }
type Overworld = OverworldSquare[][]; // 4x4, [row][col], (0,0) = entry

interface HeroInPlay {
  uid: string; id: string;
  loc:
    | { at: "town" }
    | { at: "overworld"; owner: PlayerId; r: number; c: number }
    | { at: "dungeon"; owner: PlayerId; space: number }   // 0-4; leaving (3,3) enters space 0 directly
    | { at: "fight"; owner: PlayerId };                    // the Villain fight
  tempts: Record<PlayerId, number>;  // per dungeon, while in Town; lured at 1/2/3 by tier; reset on return to Town
  health: number;                    // max = card health (+1 Warrior); dies at 0
  statuses: { status: Status; rounds: number }[]; // the same status adds to rounds; ticks down in the End Phase
  carrying: Card | null;             // an Item; Paragon/Legendary arrive with 1
  trip: {                            // reset each time the Hero leaves Town
    statusIgnores: number;           // Mage passive (+ Spellbook of Wards)
    trapSkips: number;               // Rogue passive (+ Lockpicks)
    lingered: boolean;               // Slowed: has spent its extra round in this space
    path: [number, number][];        // Overworld squares visited, for "move back" effects
    moved: boolean; justLured: boolean; forcedDir: "right" | "down" | null;
  };
}

// A dungeon space holds a stack of rooms. The last one is the top (its effect is active);
// the ones below give their coveredBonus, so taller stacks get stronger.
interface DungeonSpace { stack: Card[]; champion: { card: Card; level: number; used: boolean } | null; } // the Champion belongs to the space (empty space: Q-49c, a config option)

interface PlayerState {
  id: PlayerId; name: string; isBot: boolean;
  villains: { card: Card; damage: number; vanquished: boolean; revealed: boolean }[]; // 3 after the draft; reserves stay face-down
  activeVillain: number | null;     // index; null between a vanquish and choosing the next Villain
  needsVillainChoice: boolean;
  draftPack: Card[];                // setup only
  hand: { rooms: Card[]; tricks: Card[] }; // limit 7 combined, checked when you finish the End Phase
  pendingTricks: Card[][];          // "gain a Trick" = draw 2, keep 1: choices still to make
  exhausted: { card: Card; refreshIn: number }[]; // Spells: -1 each Upkeep, back to hand at 0
  powerUsed: boolean;               // Villain power with recharges: true
  dungeon: DungeonSpace[];          // exactly 5, from the entrance
  championReserve: Card[];          // hired in the Town Phase, not yet placed
  minions: ("home" | "town" | number)[]; // identical tokens, max 5; a number is a dungeon space
  minionTargets: string[];          // Hero uid per Town Minion, chosen each Lure Phase
  overworld: Overworld;
  coins: number;
  treasury: Card[];                 // Treasure cards and stored Tainted Items (Items lure their own class)
  treasureTokens: { type: TreasureType; value: number }[]; // from Rooms that add treasure in Upkeep
  sustained: { card: Card; exhausted: boolean }[]; // Tainted Items, max 2
  souls: number;                    // spendable, through Rooms' soulExchanges in the End Phase
  soulsTotal: number;               // harvested ever; unlocks Treasure cards; the tie-break
  claimed: Card[]; // Objectives this player has claimed (public)
  eliminated: boolean;
  allow: { placements: number; monsterMoves: number; championMoves: number; treasureBuys: number }; // what is left this phase
  buffs: { dice?: number; damage?: number; space?: number; square?: [number, number]; allMonsters?: true; villain?: true; trapRooms?: true }[]; // from Tricks and Items; cleared in Upkeep
  exchangesUsed: Record<string, number>; // soul exchanges used this End Phase
  round_: { lootTiers: number[]; kills: number; harvested: boolean; dungeonKill: boolean; tricks: number }; // reset each Upkeep
}

interface GameState {
  config: Config;                    // src/engine/config.js: an option for every Open question the code touches
  seed: number; rng: number;         // seeded (mulberry32), so games replay exactly
  round: number;
  phase: "setup" | Phase | "gameOver";
  step: { type: StepType; mode: "sim"; waiting: PlayerId[] } | { type: StepType; mode: "seq"; order: PlayerId[]; idx: number };
  // StepType: draftVillain, chooseVillain, startingTricks, roomDraft (setup);
  //           town, build, buildTricks, lure, adventure, end (each round); chooseVillain again after a vanquish
  firstPlayer: PlayerId;             // Town picks and Trick turns go clockwise from here; moves left each round
  players: PlayerState[];
  markets: { dungeon: Market; terrain: Market; champion: Market; treasure: Market; objective: Market };
  heroDeck: Card[]; itemDeck: Card[]; trickDeck: Card[]; trickDiscard: Card[]; villainDeck: Card[];
  heroes: HeroInPlay[];              // alive, in Town or in someone's lands
  fallen: { uid: string; id: string; killer: PlayerId; round: number }[];
  townShop: Card[];                  // Items no Hero was eligible for; oldest first (Q-36d)
  lureBonus: Record<PlayerId, Record<string, number>>; // extra tempts on a Hero this Lure Phase (Tricks, powers)
  lureGold: Record<PlayerId, Record<string, number>>;  // extra Gold for one Hero this Lure Phase (Lure of Gold)
  buildSnapshot: Record<PlayerId, object> | null;      // what others see of your lands until the Build reveal
  log: { n: number; round: number; phase: string; text: string; kind?: string; only?: PlayerId }[]; // `only` = a private line
  result: { heroesWin: boolean; winners: PlayerId[]; standings: { pid: PlayerId; objectives: number; souls: number; coins: number }[]; solo: boolean } | null;
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
- **Hidden information:** hands, reserve villains and the decks (including the Objective deck) are secret, so the rules engine gives each player their own view of the state (`src/engine/view.js`).
- **The rules engine stays separate from the UI**, so the same rules run in tests (`npm test`), bot simulations (`npm run simulate`) and the online server (`server/index.js`).
