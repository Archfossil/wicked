// Checks data/<set>/*.json for missing fields, bad values and duplicate IDs,
// and reports how many players the set has enough cards for.
// Usage: node tools/validate-data.mjs [set]   (default set: core)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const set = process.argv[2] ?? "core";
const load = (f) => JSON.parse(readFileSync(join(root, "data", set, f), "utf8"));

const STATS = ["might", "magic", "faith", "cunning"];
const CLASSES = ["Warrior", "Mage", "Acolyte", "Rogue"];
const TIERS = ["Common", "Paragon", "Legendary"];
const PHASES = ["upkeep", "town", "build", "lure", "adventure", "end"];
const STATUSES = ["Cursed", "Slowed", "Bleeding"];
const TODO = ["name", "flavour", "art", "wording", "balance"];

const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const seen = new Set();

function checkThreat(id, t, rank) {
  if (!t) return err(id, "missing threat");
  if (!STATS.includes(t.tests)) err(id, `threat tests unknown stat "${t.tests}"`);
  if (!(t.dice >= 1)) err(id, "threat dice must be at least 1");
  if (!(t.damage >= 0)) err(id, "threat damage must be 0 or more");
  if (rank && t.rank !== rank) err(id, `threat rank should be ${rank}`);
}
function checkEffects(id, list, field) {
  if (!Array.isArray(list)) return err(id, `${field} must be a list`);
  for (const e of list) {
    if (typeof e?.op !== "string") err(id, `${field}: effect missing op`);
    if (typeof e?.text !== "string") err(id, `${field}: effect missing text`);
  }
}

const decks = {};
for (const [file, check] of [
  ["heroes.json", (c) => {
    if (!CLASSES.includes(c.class)) err(c.id, "bad class");
    if (!TIERS.includes(c.tier)) err(c.id, "bad tier");
    for (const s of [...STATS, "health"]) if (!(c.stats?.[s] >= 0)) err(c.id, `missing stat ${s}`);
    if (c.souls !== TIERS.indexOf(c.tier) + 1) err(c.id, "souls must be 1/2/3 by tier");
    if (!(c.desire >= 1)) err(c.id, "desire must be at least 1");
  }],
  ["villains.json", (c) => { checkThreat(c.id, c.threat, "Villain"); if (!(c.health > 0)) err(c.id, "health"); checkEffects(c.id, c.power, "power"); }],
  ["rooms.json", (c) => {
    if (c.threat) checkThreat(c.id, c.threat, "Monster");
    if (c.trap && c.threat?.tests !== "cunning") err(c.id, "trap Rooms test cunning");
    if (!c.threat && !c.effect?.length && !c.treasure) err(c.id, "a Room needs a threat, an effect or treasure");
    checkEffects(c.id, c.effect, "effect"); checkEffects(c.id, c.coveredBonus, "coveredBonus");
    if (c.minionBonus) checkEffects(c.id, c.minionBonus, "minionBonus");
    for (const x of c.soulExchanges ?? []) { if (!(x.souls >= 1)) err(c.id, "soul exchange cost"); checkEffects(c.id, [x.gives], "soulExchanges"); }
    if (c.treasure && ![...CLASSES, "Gold"].includes(c.treasure.type)) err(c.id, "bad treasure type");
  }],
  ["terrain.json", (c) => {
    if (c.kind === "hazard") checkThreat(c.id, c.threat, "Monster");
    else if (c.kind === "status") { if (!STATUSES.includes(c.status)) err(c.id, "bad status"); if (!(c.statusRounds >= 1)) err(c.id, "statusRounds"); }
    else err(c.id, "kind must be hazard or status");
  }],
  ["monsters.json", (c) => { checkThreat(c.id, c.threat, "Monster"); checkEffects(c.id, c.preferredBonus, "preferredBonus"); }],
  ["champions.json", (c) => {
    if (!(c.cost >= 1)) err(c.id, "cost"); if (!(c.dice >= 1)) err(c.id, "dice");
    checkEffects(c.id, c.roomBonus, "roomBonus");
    for (const l of c.levels ?? []) { if (!(l.coins >= 1)) err(c.id, "level cost"); checkEffects(c.id, l.effect, "level effect"); }
  }],
  ["tricks.json", (c) => {
    if (!c.phases?.length || c.phases.some((p) => !PHASES.includes(p))) err(c.id, "phases");
    if ((c.type === "Spell") !== (c.recharge !== undefined)) err(c.id, "only Spells have a recharge");
    if (c.recharge !== undefined && ![1, 2, 3].includes(c.recharge)) err(c.id, "recharge must be 1-3");
    checkEffects(c.id, c.effect, "effect");
  }],
  ["items.json", (c) => { if (!CLASSES.includes(c.type)) err(c.id, "bad type"); checkEffects(c.id, c.heroEffect, "heroEffect"); checkEffects(c.id, c.villainEffect, "villainEffect"); }],
  ["treasures.json", (c) => {
    if (![...CLASSES, "Gold"].includes(c.type)) err(c.id, "bad type");
    if (!(c.value >= 1) || !(c.soulThreshold >= 0) || !(c.coinCost >= 0)) err(c.id, "value, threshold or cost");
  }],
  ["objectives.json", (c) => { if (!["event", "state"].includes(c.kind)) err(c.id, "kind"); if (typeof c.trigger?.op !== "string") err(c.id, "trigger op"); }],
]) {
  const cards = load(file);
  decks[file] = cards;
  for (const c of cards) {
    if (!c.id) { err(file, "card without id"); continue; }
    if (seen.has(c.id)) err(c.id, "duplicate id");
    seen.add(c.id);
    if (c.todo && c.todo.some((t) => !TODO.includes(t))) err(c.id, `unknown todo item (allowed: ${TODO.join(", ")})`);
    if (c.copies !== undefined && !(c.copies >= 1)) err(c.id, "copies must be at least 1");
    check(c);
  }
}

const region = load("region.json");
const deckFile = { heroes: "heroes.json", villains: "villains.json", rooms: "rooms.json", terrain: "terrain.json", monsters: "monsters.json", champions: "champions.json", tricks: "tricks.json", items: "items.json", treasures: "treasures.json", objectives: "objectives.json" };
for (const [deck, list] of Object.entries(region.decks)) {
  const known = new Set((decks[deckFile[deck]] ?? []).map((c) => c.id));
  for (const id of list) if (!known.has(id)) err(region.id, `deck ${deck} lists unknown card ${id}`);
}

// How many players can this set seat? (setup needs; markets refill from what's left)
const count = (f) => decks[f].reduce((n, c) => n + (c.copies ?? 1), 0);
const needs = [
  ["Villains", count("villains.json"), (p) => 5 * p, "draft draws 5 per player"],
  ["Rooms", count("rooms.json"), (p) => 5 * p + (p + 2), "5 opening Rooms each + a full market"],
  ["Tricks", count("tricks.json"), (p) => 6 * p, "3 starting Tricks at draw 2, keep 1"],
  ["Objectives", count("objectives.json"), (p) => 5 * p, "5 dealt per player"],
  ["Heroes", count("heroes.json"), (p) => p + 1, "1 per player at setup + 1 in round 1"],
  ["Terrain", count("terrain.json"), (p) => p + 2, "a full market"],
  ["Monsters", count("monsters.json"), (p) => p + 2, "a full market"],
  ["Treasures", count("treasures.json"), (p) => p + 2, "a full market"],
  ["Champions", count("champions.json"), () => 3, "a market of 3"],
];
let maxPlayers = 6;
const lines = needs.map(([name, have, need, why]) => {
  let p = 6; while (p > 0 && need(p) > have) p--;
  maxPlayers = Math.min(maxPlayers, p);
  return `  ${name.padEnd(11)} ${String(have).padStart(3)} cards  -> enough for ${p} player(s)  (${why})`;
});

if (errors.length) { console.error(errors.join("\n")); console.error(`\n${errors.length} problem(s) in data/${set}`); }
else console.log(`data/${set}: ${seen.size} card definitions, no problems found`);
console.log(lines.join("\n"));
console.log(`Supports up to ${maxPlayers} player(s).`);
process.exit(errors.length ? 1 : 0);
