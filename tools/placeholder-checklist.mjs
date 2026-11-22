// Builds docs/placeholders.md from the `todo` lists in data/<set>/*.json.
// Usage: node tools/placeholder-checklist.mjs [set]   (default set: core)
//
// The data files are the source of truth. When a card's name, flavour, art,
// wording or numbers are final, remove that entry from the card's `todo` list
// and rerun this script. Don't tick boxes in the generated file by hand.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const set = process.argv[2] ?? "core";
const dir = join(root, "data", set);

const TASKS = ["name", "flavour", "art", "wording", "balance"];
const SECTIONS = [
  ["heroes.json", "Heroes"], ["villains.json", "Villains"], ["rooms.json", "Rooms"],
  ["terrain.json", "Terrain"], ["monsters.json", "Monsters"], ["champions.json", "Champions"],
  ["tricks.json", "Tricks"], ["items.json", "Items"], ["treasures.json", "Treasures"],
  ["objectives.json", "Objectives"], ["region.json", "Region"],
];

const files = new Set(readdirSync(dir));
const box = (card, task) => (card.todo?.includes(task) ? "[ ]" : "[x]");
const hasText = (v) => v && typeof v === "object" && (typeof v.text === "string" || Object.values(v).some(hasText));
const applies = (card, task) =>
  card.todo?.includes(task) ||
  (task === "name" && "name" in card) ||
  (task === "flavour" && "flavour" in card) ||
  (task === "art" && "art" in card) ||
  (task === "wording" && hasText(card)) ||
  (task === "balance" && !card.id.startsWith("region-"));

let open = 0, total = 0;
const out = [];
for (const [file, title] of SECTIONS) {
  if (!files.has(file)) continue;
  const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const cards = Array.isArray(raw) ? raw : [raw];
  const tasks = TASKS.filter((t) => cards.some((c) => applies(c, t)));
  const remaining = cards.filter((c) => c.todo?.length).length;
  out.push(`## ${title} (${remaining} of ${cards.length} still have placeholders)`, "");
  out.push(`| Card | ${tasks.map((t) => t[0].toUpperCase() + t.slice(1)).join(" | ")} |`);
  out.push(`| --- | ${tasks.map(() => "---").join(" | ")} |`);
  for (const c of cards) {
    const label = c.name ?? c.text;
    const copies = c.copies > 1 ? ` ×${c.copies}` : "";
    out.push(`| ${label}${copies} <br><sub>\`${c.id}\`</sub> | ${tasks.map((t) => (applies(c, t) ? box(c, t) : "—")).join(" | ")} |`);
    for (const t of tasks) if (applies(c, t)) { total++; if (c.todo?.includes(t)) open++; }
  }
  out.push("");
}

const header = [
  `# Placeholder checklist: ${set} set`,
  "",
  "> **Generated file, don't edit by hand.** Run `node tools/placeholder-checklist.mjs` to rebuild it.",
  "",
  "Every card in `data/" + set + "/` started as a placeholder so the rules could be tested. This list is for the art and design team to sweep through and replace them.",
  "",
  "**How to sign something off:** in the card's JSON, remove the finished item from its `todo` list (and fill in `flavour` or `art` if that's what you did). Then rerun the script. A card with an empty `todo` list is final.",
  "",
  "| Column | What to replace |",
  "| --- | --- |",
  "| Name | The working name (e.g. \"Guard Post\") with the real one |",
  "| Flavour | The `\"TODO\"` flavour text |",
  "| Art | `art: null` with a path or ID for the card art |",
  "| Wording | The rules text in each effect's `text` (and objective `text`) with final card wording |",
  "| Balance | The numbers: stats, dice, damage, Health, costs, thresholds, copies. Placeholder values, not playtested |",
  "",
  `**Progress:** ${total - open} of ${total} items done.`,
  "",
  "Content gaps the numbers don't cover yet are listed in [`data/README.md`](../data/README.md#known-gaps).",
  "",
];
writeFileSync(join(root, "docs", "placeholders.md"), header.concat(out).join("\n"));
console.log(`docs/placeholders.md: ${open} of ${total} items still open`);
