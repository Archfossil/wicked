// Game options. Anything here tagged with a Q-number is an OPEN question in
// docs/design/open-questions.md: the default is the design's stated assumption
// (or the simplest reading where it states none). Change these to playtest the
// alternatives; don't treat the defaults as decided rules.

export const DEFAULT_CONFIG = {
  set: "core",

  // Testing aid, not a rule: cap the Hero deck to make games shorter (null = full deck).
  heroDeckLimit: null,

  // Q-01a: solo mode has no designed goal yet. With 1 player the game runs as a
  // sandbox and ends with a summary instead of an Overlord.

  // Q-22: may players draw blind off the Dungeon deck in the Town Phase?
  blindDrawInTown: false,

  // Q-21 / Q-25 / Q-34b: do these markets discard their oldest card each Upkeep?
  shiftTerrainMarket: true,
  shiftChampionMarket: true,
  shiftTreasureMarket: true,

  // Q-34b: how many Treasures may a player buy each End Phase?
  treasureBuysPerEnd: 1,

  // Q-35a: does a covered Room's soul exchange still work? How often per End Phase?
  coveredSoulExchanges: false,
  soulExchangeUsesPerEnd: 1,

  // Q-49c: Champion in a space whose last Room is destroyed: "stays" (waits, doesn't fight) or "discard".
  championOnEmptiedSpace: "stays",

  // Q-56a: Mage ignores the first status inflicted per trip out of Town ("first"), Rogue skips
  // one trap Room per trip, Acolyte healing is capped at max Health.
  acolyteHealCapped: true,

  // Q-59b: does Warrior overflow also weaken Rooms with creatures in them?
  warriorOverflowAffectsRooms: false,

  // Q-80: on an edge the move is forced (assumed yes; there's no alternative coded).
  // Q-86a: Heroes at the same distance in one player's lands resolve in arrival order.

  // Q-87b: does Slowed also slow Overworld movement?
  slowedAffectsOverworld: false,

  // Q-54d: a stolen Item stops being Tainted and the Hero keeps it only if eligible (assumed).

  // Q-78: do souls gained as an Objective reward count as harvested (soulsTotal:
  // Treasure thresholds and the tie-break)? Assumed no: they're spendable only.
  rewardSoulsHarvested: false,

  // Q-33b: Hero loot (Coins) is paid in the End Phase (assumed).
};

export const HAND_LIMIT = 7;
export const MAX_MINIONS = 5;
export const MAX_SUSTAINED = 2;
export const DUNGEON_SPACES = 5;
export const GRID = 4;
export const TOWN_CAPACITY_DEFAULT = 2;
export const STARTING_COINS = 3;
export const LURE = { Common: 1, Paragon: 2, Legendary: 3 };
export const TIER_RANK = { Common: 1, Paragon: 2, Legendary: 3 };
export const THREAT_RANK = { Monster: 1, Champion: 2, Villain: 3 };
export const TIER_VALUE = { Common: 1, Paragon: 2, Legendary: 3 }; // souls, loot, tier damage
export const CLASSES = ["Warrior", "Mage", "Acolyte", "Rogue"];
export const CLASS_STAT = { Warrior: "might", Mage: "magic", Acolyte: "faith", Rogue: "cunning" };
