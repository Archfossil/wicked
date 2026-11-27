// Loads a card set from data/<set>/ and turns deck lists into card instances.
// A card instance in the game state is { uid, id }: `id` points at the card
// definition, `uid` tells copies apart. Look definitions up with `def()`.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const FILES = {
  heroes: "heroes.json", villains: "villains.json", rooms: "rooms.json", terrain: "terrain.json",
  monsters: "monsters.json", champions: "champions.json", tricks: "tricks.json", items: "items.json",
  treasures: "treasures.json", objectives: "objectives.json",
};

const sets = new Map();

export function loadSet(set = "core") {
  if (sets.has(set)) return sets.get(set);
  const read = (f) => JSON.parse(readFileSync(join(root, "data", set, f), "utf8"));
  const cards = {};
  for (const [kind, file] of Object.entries(FILES)) {
    for (const c of read(file)) { cards[c.id] = { ...c, deck: kind }; }
  }
  const region = read("region.json");
  const loaded = { set, cards, region };
  sets.set(set, loaded);
  return loaded;
}

/** Expands a region deck list into instances, honouring `copies`. */
export function buildDeck(cards, ids) {
  const out = [];
  for (const id of ids) {
    const c = cards[id];
    if (!c) throw new Error(`Unknown card ${id}`);
    for (let i = 1; i <= (c.copies ?? 1); i++) out.push({ uid: `${id}#${i}`, id });
  }
  return out;
}
